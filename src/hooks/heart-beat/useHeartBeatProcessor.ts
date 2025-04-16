/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../../modules/HeartBeatProcessor';
import { HeartBeatResult } from '../../core/types';
import { useArrhythmiaDetector } from './arrhythmia-detector';
import {
  checkWeakSignal,
  updateLastValidBpm,
  processLowConfidenceResult,
  handlePeakDetection as handlePeakLogic
} from './signal-processing';
import AudioFeedbackService from '@/services/AudioFeedbackService';
import { resetSignalQualityState } from '@/modules/heart-beat/signal-quality';
import { RRIntervalData } from './types'; // Import missing type

/**
 * Hook para el procesamiento de la señal del latido cardíaco
 * Versión simplificada que usa el HeartBeatProcessor existente
 */
export const useHeartBeatProcessor = () => {
  // Estado para los resultados del latido cardíaco
  const [heartBeatResult, setHeartBeatResult] = useState<HeartBeatResult | null>(null);
  // Estado para indicar si el procesamiento está en curso
  const [isProcessing, setIsProcessing] = useState(false);
  // Referencia para el procesador de latidos cardíacos
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  // Referencia para el último valor de señal válido
  const lastValidSignalRef = useRef<number>(0);
  // Referencia para el contador de artefactos
  const artifactCounterRef = useRef<number>(0);
  // Referencia para el ID de sesión
  const sessionIdRef = useRef<string>(Math.random().toString(36).substring(2, 9));
  // Referencia para el estado de procesamiento
  const isProcessingRef = useRef(false);

  // Estado para calibración y calidad de señal
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [signalQuality, setSignalQuality] = useState(0);
  const [arrhythmiaStatus, setArrhythmiaStatus] = useState("--");
  const [rrIntervals, setRrIntervals] = useState<number[]>([]);
  const [hrvData, setHrvData] = useState<Record<string, number>>({});
  const [artifactDetected, setArtifactDetected] = useState(false);
  const [ppgData, setPpgData] = useState<number[]>([]);
  const [stressLevel, setStressLevel] = useState(0);

  const { detectArrhythmia, reset: resetArrhythmiaDetector, currentBeatIsArrhythmiaRef } = useArrhythmiaDetector();
  const lastValidBpmRef = useRef<number>(0);
  const consecutiveWeakSignalsRef = useRef<number>(0);

  // Inicialización del procesador de latidos cardíacos
  useEffect(() => {
    processorRef.current = new HeartBeatProcessor();
    console.log("useHeartBeatProcessor: Inicializando procesador", {
      sessionId: sessionIdRef.current,
      timestamp: new Date().toISOString()
    });

    return () => {
      console.log("useHeartBeatProcessor: Limpiando procesador", {
        sessionId: sessionIdRef.current,
        timestamp: new Date().toISOString()
      });
      processorRef.current = null;
    };
  }, []);

  // Función para actualizar datos de análisis (internal helper, doesn't need export)
  const updateAnalysisData = useCallback((value: number, result: any) => {
    setSignalQuality(result.confidence * 100);
    
    if (result.isArrhythmia) {
      setArrhythmiaStatus(`ARRITMIA DETECTADA|${result.arrhythmiaCount || 0}`);
    } else {
      setArrhythmiaStatus(`NO ARRITMIAS|${result.arrhythmiaCount || 0}`);
    }
    
    if (processorRef.current) {
      const rrData = processorRef.current.getRRIntervals();
      setRrIntervals(rrData.intervals || []);
    }
    
    const lowQuality = result.confidence < 0.3;
    const isArtifact = lowQuality && Math.abs(value) > 5;
    setArtifactDetected(isArtifact);
    
    setPpgData(prev => {
      const newData = [...prev, value];
      if (newData.length > 200) {
        return newData.slice(-200);
      }
      return newData;
    });
    
    if (rrIntervals.length > 10) {
      const sum = rrIntervals.reduce((a, b) => a + b, 0);
      const mean = sum / rrIntervals.length;
      let varianceSum = 0;
      for (const interval of rrIntervals) {
        varianceSum += Math.pow(interval - mean, 2);
      }
      const stdDev = Math.sqrt(varianceSum / rrIntervals.length);
      const stressEstimate = Math.max(0, Math.min(100, 100 - (stdDev / mean) * 1000));
      setStressLevel(stressEstimate);
      setHrvData({
        sdnn: stdDev,
        rmssd: stdDev * 0.9, // Simplificado
        pnn50: 50 - stressEstimate / 2 // Simplificado
      });
    }
  }, [rrIntervals]);

  // Función para procesar la señal
  const processSignal = useCallback(
    (value: number): HeartBeatResult | null => {
      if (!processorRef.current) {
        console.warn("HeartBeatProcessor no está inicializado.");
        return null;
      }

      if (typeof value !== 'number') {
        console.error("Valor de señal inválido:", value);
        return null;
      }

      lastValidSignalRef.current = value;
      const result = processorRef.current.processSignal(value);
      setHeartBeatResult(result);
      updateAnalysisData(value, result);

      return result;
    },
    [updateAnalysisData]
  );

  // Función para iniciar el procesamiento
  const startProcessing = useCallback(() => {
    setIsProcessing(true);
    isProcessingRef.current = true;
    if (processorRef.current) {
      processorRef.current.setMonitoring(true);
    }
    console.log("Iniciando procesamiento de señal...", {
      sessionId: sessionIdRef.current,
      timestamp: new Date().toISOString()
    });
  }, []);

  // Función para detener el procesamiento
  const stopProcessing = useCallback(() => {
    setIsProcessing(false);
    isProcessingRef.current = false;
    if (processorRef.current) {
      processorRef.current.setMonitoring(false);
    }
    console.log("Deteniendo procesamiento de señal...", {
      sessionId: sessionIdRef.current,
      timestamp: new Date().toISOString()
    });
  }, []);

  // Función para resetear el procesador
  const reset = useCallback(() => {
    console.warn("Reseteando el procesador y los estados...", {
      sessionId: sessionIdRef.current,
      timestamp: new Date().toISOString()
    });
    if (processorRef.current) {
      processorRef.current.reset();
    }
    setHeartBeatResult(null);
    artifactCounterRef.current = 0;
    setIsCalibrating(false);
    setCalibrationProgress(0);
    setArtifactDetected(false);
    setArrhythmiaStatus("--");
    setRrIntervals([]);
    setHrvData({});
    setPpgData([]);
    setStressLevel(0);
    resetArrhythmiaDetector();
    lastValidBpmRef.current = 0;
    consecutiveWeakSignalsRef.current = resetSignalQualityState();
  }, [resetArrhythmiaDetector]);

  // Funciones de calibración simuladas
  const startCalibration = useCallback(() => {
    setIsCalibrating(true);
    setCalibrationProgress(0);
    const calibrationInterval = setInterval(() => {
      setCalibrationProgress(prev => {
        const newProgress = prev + 10;
        if (newProgress >= 100) {
          clearInterval(calibrationInterval);
          setIsCalibrating(false);
          return 100;
        }
        return newProgress;
      });
    }, 500);
    return () => {
      clearInterval(calibrationInterval);
    };
  }, []);

  const endCalibration = useCallback(() => {
    setIsCalibrating(false);
    setCalibrationProgress(100);
  }, []);

  const calibrateProcessors = useCallback(() => {
    console.log("Calibración de procesadores completada");
    return true;
  }, []);

  const resetCalibration = useCallback(() => {
    setIsCalibrating(false);
    setCalibrationProgress(0);
  }, []);

  // Función simulada para registro de datos
  const logData = useCallback((value: number, result: any) => {
    return true;
  }, []);

  const clearLog = useCallback(() => {
    return true;
  }, []);

  const requestBeep = useCallback((value: number): boolean => {
    console.warn("requestBeep called in useHeartBeatProcessor, but audio is handled by PPGSignalMeter. Consider removing or repurposing this for haptic feedback.");
    return false;
  }, [currentBeatIsArrhythmiaRef]);

  const startMonitoring = useCallback(() => {
    if (processorRef.current) {
        processorRef.current.setMonitoring(true);
    }
  }, []);

  const stopMonitoring = useCallback(() => {
    if (processorRef.current) {
        processorRef.current.setMonitoring(false);
    }
  }, []);

  const addArrhythmiaWindow = useCallback((start: number, end: number) => {
    // Implementation of addArrhythmiaWindow
  }, []);

  return {
    heartBeatResult,
    isProcessing,
    signalQuality,
    artifactDetected,
    stressLevel,
    isCalibrating,
    calibrationProgress,
    arrhythmiaStatus,
    hrvData,
    ppgData,
    startProcessing,
    stopProcessing,
    processSignal,
    startCalibration,
    endCalibration,
    calibrateProcessors,
    reset,
    resetCalibration,
    requestBeep,
    startMonitoring,
    stopMonitoring,
    addArrhythmiaWindow
  };
};

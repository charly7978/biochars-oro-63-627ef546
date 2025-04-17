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

  // Función para procesar la señal
  const processSignal = useCallback(
    (value: number) => {
      if (!processorRef.current) {
        console.warn("HeartBeatProcessor no está inicializado.");
        return null;
      }

      // Verificar si el valor de la señal es un número
      if (typeof value !== 'number') {
        console.error("Valor de señal inválido:", value);
        return null;
      }

      // Actualizar la última señal válida
      lastValidSignalRef.current = value;

      // Simular el procesamiento de la señal y obtener los resultados
      const result = processorRef.current.processSignal(value);

      // Actualizar el estado con los resultados del procesamiento
      setHeartBeatResult(result);

      // Actualizar datos adicionales de análisis
      updateAnalysisData(value, result);

      // Devolver los resultados
      return result;
    },
    []
  );

  // Función para actualizar datos de análisis
  const updateAnalysisData = useCallback((value: number, result: any) => {
    // Actualizar calidad de señal (simplificado)
    setSignalQuality(result.confidence * 100);
    
    // Actualizar detección de arritmias
    if (result.isArrhythmia) {
      setArrhythmiaStatus(`ARRITMIA DETECTADA|${result.arrhythmiaCount || 0}`);
    } else {
      setArrhythmiaStatus(`NO ARRITMIAS|${result.arrhythmiaCount || 0}`);
    }
    
    // Actualizar datos RR si están disponibles
    if (processorRef.current) {
      const rrData = processorRef.current.getRRIntervals();
      setRrIntervals(rrData.intervals || []);
    }
    
    // Detección de artefactos (simplificada)
    const lowQuality = result.confidence < 0.3;
    const isArtifact = lowQuality && Math.abs(value) > 5;
    setArtifactDetected(isArtifact);
    
    // Actualizar buffer PPG
    setPpgData(prev => {
      const newData = [...prev, value];
      if (newData.length > 200) {
        return newData.slice(-200);
      }
      return newData;
    });
    
    // Estimar nivel de estrés (simplificado)
    if (rrIntervals.length > 10) {
      // Cálculo básico basado en variabilidad
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
    // Simulación de registro, no hace nada real
    return true;
  }, []);

  const clearLog = useCallback(() => {
    // Simulación de limpieza de registro, no hace nada real
    return true;
  }, []);

  // Esta función ya no debería controlar el audio directamente.
  // Podría usarse para forzar una vibración o feedback háptico si se desea.
  const requestBeep = useCallback((value: number): boolean => {
    console.warn("requestBeep called in useHeartBeatProcessor, but audio is handled by PPGSignalMeter. Consider removing or repurposing this for haptic feedback.");
    // Ejemplo: disparar vibración desde el servicio central
    // AudioFeedbackService.getInstance().vibrateOnly(currentBeatIsArrhythmiaRef.current ? 'arrhythmia' : 'normal');
    return false; // Indicar que no se manejó el beep aquí
  }, [currentBeatIsArrhythmiaRef]);

  const startMonitoring = useCallback(() => {
    processorRef.current?.setMonitoring(true);
    // No es necesario resetear aquí si el procesador maneja su estado inicial
  }, []);

  const stopMonitoring = useCallback(() => {
    processorRef.current?.setMonitoring(false);
    // Considerar si resetear al detener
    // reset();
  }, []);

  const addArrhythmiaWindow = useCallback((start: number, end: number) => {
    // Implementation of addArrhythmiaWindow
  }, []);

  return {
    heartBeatResult,
    isProcessing,
    startProcessing,
    stopProcessing,
    processSignal,
    signalQuality,
    artifactDetected,
    stressLevel,
    isCalibrating,
    startCalibration,
    endCalibration,
    calibrationProgress,
    calibrateProcessors,
    reset,
    arrhythmiaStatus,
    hrvData,
    ppgData,
    requestBeep,
    startMonitoring,
    stopMonitoring,
    addArrhythmiaWindow
  };
};

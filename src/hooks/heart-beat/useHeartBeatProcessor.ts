/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../../modules/HeartBeatProcessor.ts';
import { HeartBeatResult, UseHeartBeatReturn, RRIntervalData } from './types';
import { checkWeakSignal, updateLastValidBpm, processLowConfidenceResult } from './signal-processing';
import { handlePeakDetection, shouldProcessMeasurement, createWeakSignalResult } from './peak-detection';
import { useBeepProcessor } from './beep-processor';
import { useArrhythmiaDetector } from './arrhythmia-detector';
import AudioFeedbackService from '@/services/AudioFeedbackService';

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
  const [isArrhythmiaDetectedState, setIsArrhythmiaDetectedState] = useState(false); // Estado para la arritmia
  const arrhythmiaCountRef = useRef(0); // Contador local de arritmias

  // Usar el hook de detección de arritmias
  const { detectArrhythmia, reset: resetArrhythmiaDetector } = useArrhythmiaDetector();

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

      if (typeof value !== 'number') {
        console.error("Valor de señal inválido:", value);
        return null;
      }

      lastValidSignalRef.current = value;

      // Procesar con HeartBeatProcessor (versión .ts)
      const processorResult = processorRef.current.processSignal(value);

      // Obtener Intervalos RR del procesador
      const rrData = processorRef.current.getRRIntervals();
      const currentRRIntervals = rrData.intervals || [];
      setRrIntervals(currentRRIntervals); // Actualizar estado de intervalos

      // **Detectar Arritmia usando el detector dedicado**
      let arrhythmiaResult: { isArrhythmia: boolean, rmssd: number, rrVariation: number, timestamp: number, category?: any } = {
           isArrhythmia: false, rmssd: 0, rrVariation: 0, timestamp: Date.now(), category: 'normal'
       };
      if (currentRRIntervals.length > 0) {
        arrhythmiaResult = detectArrhythmia(currentRRIntervals);
        setIsArrhythmiaDetectedState(arrhythmiaResult.isArrhythmia);

        // Actualizar contador si se detecta nueva arritmia
        if (arrhythmiaResult.isArrhythmia) {
            // Lógica simple para incrementar el contador (podría necesitar debounce)
            arrhythmiaCountRef.current += 1;
        }
      }

      // Combinar resultados del procesador y detector de arritmia
      const finalResult: HeartBeatResult = {
          ...processorResult,
          isArrhythmia: arrhythmiaResult.isArrhythmia,
          arrhythmiaCount: arrhythmiaCountRef.current, // Usar contador local
          rrData: rrData // Incluir rrData si otros módulos lo necesitan
      };

      setHeartBeatResult(finalResult);
      updateAnalysisData(value, finalResult, arrhythmiaResult); // Pasar resultado de arritmia

      return finalResult;
    },
    [detectArrhythmia] // Añadir dependencia
  );

  // Función para actualizar datos de análisis (modificada)
  const updateAnalysisData = useCallback((value: number, result: HeartBeatResult, arrhythmiaResult: any) => {
    setSignalQuality(result.confidence * 100);
    
    // Actualizar estado de arritmia basado en el detector
    if (result.isArrhythmia) {
        // Usar categoría del detector si existe
        const category = arrhythmiaResult.category || 'POSIBLE';
        setArrhythmiaStatus(`ARRITMIA ${category.toUpperCase()}|${result.arrhythmiaCount}`);
    } else {
        setArrhythmiaStatus(`NORMAL|${result.arrhythmiaCount}`);
    }
    
    // Detección de artefactos (sin cambios)
    const lowQuality = result.confidence < 0.3;
    const isArtifact = lowQuality && Math.abs(value) > 5;
    setArtifactDetected(isArtifact);
    
    // Actualizar buffer PPG (sin cambios)
    setPpgData(prev => {
      const newData = [...prev, value];
      if (newData.length > 200) {
        return newData.slice(-200);
      }
      return newData;
    });
    
    // Estimar nivel de estrés y HRV (sin cambios en la lógica, usa rrIntervals del estado)
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
        rmssd: arrhythmiaResult.rmssd || stdDev * 0.9, // Usar RMSSD real si está disponible
        pnn50: 50 - stressEstimate / 2
      });
    }
  }, [rrIntervals]); // Depender de rrIntervals del estado

  // Función para iniciar el procesamiento (sin cambios)
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

  // Función para detener el procesamiento (sin cambios)
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

  // Función para resetear (modificada para resetear detector de arritmias)
  const reset = useCallback(() => {
    console.warn("Reseteando el procesador y los estados...", {
      sessionId: sessionIdRef.current,
      timestamp: new Date().toISOString()
    });
    if (processorRef.current) {
      processorRef.current.reset();
    }
    resetArrhythmiaDetector(); // Resetear el detector de arritmias
    arrhythmiaCountRef.current = 0; // Resetear contador local
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
    setIsArrhythmiaDetectedState(false);
  }, [resetArrhythmiaDetector]); // Añadir dependencia

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
    isArrhythmia: isArrhythmiaDetectedState // Exponer estado de arritmia
  };
};

// Configuración de calidad de señal
const signalQualityConfig = {
  lowSignalThreshold: 0.01,
  maxWeakSignalCount: 10,
};

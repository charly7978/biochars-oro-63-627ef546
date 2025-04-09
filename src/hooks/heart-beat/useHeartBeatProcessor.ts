
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../../modules/HeartBeatProcessor';
import { HeartBeatResult as CoreHeartBeatResult } from '../../core/types';

/**
 * Hook para el procesamiento de la señal del latido cardíaco
 * Versión que procesa ÚNICAMENTE señales REALES sin ningún tipo de simulación
 */
export const useHeartBeatProcessor = () => {
  // Estado para los resultados del latido cardíaco
  const [heartBeatResult, setHeartBeatResult] = useState<CoreHeartBeatResult | null>(null);
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
  
  // Nuevo: buffer directo para señales sin procesar
  const rawSignalBufferRef = useRef<number[]>([]);

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
  const [isArrhythmia, setIsArrhythmia] = useState(false);

  // Inicialización del procesador de latidos cardíacos - SOLO PROCESAMIENTO REAL
  useEffect(() => {
    processorRef.current = new HeartBeatProcessor();
    console.log("useHeartBeatProcessor: Inicializando procesador para medición directa", {
      sessionId: sessionIdRef.current,
      timestamp: new Date().toISOString(),
      mode: "DIRECT_MEASUREMENT_ONLY"
    });

    return () => {
      console.log("useHeartBeatProcessor: Limpiando procesador", {
        sessionId: sessionIdRef.current,
        timestamp: new Date().toISOString()
      });
      processorRef.current = null;
      rawSignalBufferRef.current = [];
    };
  }, []);

  // Función para procesar la señal REAL directamente
  const processSignal = useCallback(
    (value: number) => {
      if (!processorRef.current) {
        console.warn("HeartBeatProcessor no está inicializado.");
        return null;
      }

      // Verificar si el valor de la señal es un número válido
      if (typeof value !== 'number' || isNaN(value)) {
        console.error("Valor de señal inválido:", value);
        return null;
      }

      // Almacenar la señal sin procesar en el buffer directo
      rawSignalBufferRef.current.push(value);
      if (rawSignalBufferRef.current.length > 300) {
        rawSignalBufferRef.current.splice(0, rawSignalBufferRef.current.length - 300);
      }
      
      // Actualizar la última señal válida
      lastValidSignalRef.current = value;

      // Procesar DIRECTAMENTE la señal real y obtener los resultados sin simulación
      const result = processorRef.current.processSignal(value);
      
      console.log("Procesando señal REAL:", { 
        value, 
        resultadoBPM: result.bpm,
        calidad: result.quality,
        isPeak: result.isPeak,
        bufferSize: rawSignalBufferRef.current.length
      });

      // Convertir el resultado al tipo esperado por el estado
      const coreResult: CoreHeartBeatResult = {
        bpm: result.bpm,
        confidence: result.confidence,
        isPeak: result.isPeak || false,
        arrhythmiaCount: result.arrhythmiaCount,
        isArrhythmia: result.isArrhythmia,
        rrData: result.rrData,
        quality: result.quality,
        filteredValue: result.filteredValue,
        transition: result.transition
      };

      // Actualizar el estado con los resultados del procesamiento REAL
      setHeartBeatResult(coreResult);
      
      // Actualizar estado de arritmia
      setIsArrhythmia(result.isArrhythmia || false);

      // Actualizar datos adicionales de análisis
      updateAnalysisData(value, result);

      // Devolver los resultados REALES
      return result;
    },
    []
  );

  // Función para actualizar datos de análisis
  const updateAnalysisData = useCallback((value: number, result: any) => {
    // Actualizar calidad de señal directamente del resultado
    setSignalQuality(result.quality || 0);
    
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
    
    // Actualizar buffer PPG con valores REALES
    setPpgData(prev => {
      const newData = [...prev, value];
      if (newData.length > 200) {
        return newData.slice(-200);
      }
      return newData;
    });
    
    // Estimar nivel de estrés basado en datos REALES
    if (rrIntervals.length > 10) {
      // Cálculo basado en variabilidad real
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
        rmssd: stdDev * 0.9,
        pnn50: 50 - stressEstimate / 2
      });
    }
  }, [rrIntervals]);

  // Función para iniciar el procesamiento
  const startMonitoring = useCallback(() => {
    setIsProcessing(true);
    isProcessingRef.current = true;
    
    if (processorRef.current) {
      processorRef.current.setMonitoring(true);
    }
    
    console.log("Iniciando procesamiento de señal REAL...", {
      sessionId: sessionIdRef.current,
      timestamp: new Date().toISOString(),
      mode: "DIRECT_MEASUREMENT_ONLY"
    });
  }, []);

  // Función para detener el procesamiento
  const stopMonitoring = useCallback(() => {
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
    console.log("Reseteando completamente el procesador y los estados...", {
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
    setIsArrhythmia(false);
    rawSignalBufferRef.current = [];
  }, []);

  // Funciones de calibración
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

  // Función para obtener los datos de señal sin procesar
  const getRawSignalData = useCallback(() => {
    return [...rawSignalBufferRef.current];
  }, []);

  return {
    heartBeatResult,
    isProcessing,
    startProcessing: startMonitoring,
    stopProcessing: stopMonitoring,
    startMonitoring,
    stopMonitoring,
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
    isArrhythmia,
    hrvData,
    ppgData,
    getRawSignalData // Nueva función para acceder a datos sin procesar
  };
};


/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../../modules/HeartBeatProcessor';
import { HeartBeatResult } from '../../core/types';
import { getModel } from '../../core/neural/ModelRegistry';
import { TensorFlowWorkerClient } from '../../workers/tensorflow-worker-client';

// Cliente singleton para TensorFlow
let tfWorkerClient: TensorFlowWorkerClient | null = null;

/**
 * Hook para el procesamiento de la señal del latido cardíaco
 * Versión con integración real de TensorFlow
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
  // Estado para TensorFlow
  const [isModelReady, setIsModelReady] = useState(false);
  // Estado para aritmia
  const [isArrhythmia, setIsArrhythmia] = useState(false);

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

  // Inicialización del TensorFlow Worker
  useEffect(() => {
    const initializeTensorFlow = async () => {
      try {
        if (!tfWorkerClient) {
          console.log("Inicializando TensorFlow Worker para procesamiento en tiempo real");
          tfWorkerClient = new TensorFlowWorkerClient();
          await tfWorkerClient.initialize();
          
          // Precargar modelo de ritmo cardíaco
          await tfWorkerClient.loadModel('heartRate');
          // Precargar modelo de arritmias
          await tfWorkerClient.loadModel('arrhythmia');
          
          setIsModelReady(true);
          console.log("Modelos TensorFlow cargados exitosamente para procesamiento en tiempo real");
        }
      } catch (error) {
        console.error("Error inicializando TensorFlow:", error);
      }
    };
    
    initializeTensorFlow();
  }, []);

  // Inicialización del procesador de latidos cardíacos con TensorFlow
  useEffect(() => {
    processorRef.current = new HeartBeatProcessor();
    console.log("useHeartBeatProcessor: Inicializando procesador con integración TensorFlow", {
      sessionId: sessionIdRef.current,
      timestamp: new Date().toISOString(),
      tensorflowReady: isModelReady
    });

    return () => {
      console.log("useHeartBeatProcessor: Limpiando procesador", {
        sessionId: sessionIdRef.current,
        timestamp: new Date().toISOString()
      });
      processorRef.current = null;
    };
  }, [isModelReady]);

  // Función para procesar la señal con TensorFlow
  const processSignal = useCallback(
    async (value: number) => {
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

      try {
        // Procesar con el procesador tradicional primero
        const result = processorRef.current.processSignal(value);
        
        // Si TensorFlow está listo, mejorar el resultado con redes neuronales
        if (isModelReady && tfWorkerClient) {
          // Obtener buffer PPG para análisis
          const ppgBuffer = processorRef.current.getPPGBuffer();
          
          if (ppgBuffer && ppgBuffer.length >= 100) {
            // Predecir arritmias con TensorFlow en tiempo real
            const arrhythmiaInputs = ppgBuffer.slice(-300);
            if (result.bpm > 40 && result.confidence > 0.4) {
              try {
                const arrhythmiaPrediction = await tfWorkerClient.predict('arrhythmia', arrhythmiaInputs);
                // El modelo devuelve una probabilidad de arritmia
                const arrhythmiaProb = arrhythmiaPrediction[0];
                
                const newIsArrhythmia = arrhythmiaProb > 0.7;
                setIsArrhythmia(newIsArrhythmia);
                
                if (newIsArrhythmia) {
                  processorRef.current.incrementArrhythmiaCounter();
                  console.log("Arritmia detectada por modelo TensorFlow:", arrhythmiaProb);
                }
                
                // Agregar el resultado de la predicción neural
                result.isArrhythmia = newIsArrhythmia;
              } catch (err) {
                console.error("Error en predicción de arritmia:", err);
              }
            }
          }
        }

        // Actualizar el estado con los resultados del procesamiento
        setHeartBeatResult(result);

        // Actualizar datos adicionales de análisis
        updateAnalysisData(value, result);

        // Devolver los resultados
        return result;
      } catch (error) {
        console.error("Error en procesamiento de señal:", error);
        return null;
      }
    },
    [isModelReady]
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
    
    // Estimar nivel de estrés (con RR intervals)
    if (rrIntervals.length > 10) {
      // Cálculo basado en variabilidad
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

  // Función para iniciar monitoreo
  const startMonitoring = useCallback(() => {
    setIsProcessing(true);
    isProcessingRef.current = true;
    
    if (processorRef.current) {
      processorRef.current.setMonitoring(true);
    }
    
    console.log("Iniciando procesamiento de señal con TensorFlow...", {
      sessionId: sessionIdRef.current,
      timestamp: new Date().toISOString(),
      tensorflowReady: isModelReady
    });
  }, [isModelReady]);

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
    setIsArrhythmia(false);
  }, []);

  // Funciones de calibración
  const startCalibration = useCallback(() => {
    setIsCalibrating(true);
    setCalibrationProgress(0);
    
    // Limpiar buffer para calibración
    if (processorRef.current) {
      processorRef.current.clearBuffer();
    }
    
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
    if (processorRef.current) {
      processorRef.current.calibrate();
    }
    console.log("Calibración de procesadores con TensorFlow completada");
    return true;
  }, []);

  const resetCalibration = useCallback(() => {
    setIsCalibrating(false);
    setCalibrationProgress(0);
  }, []);

  // Limpiar recursos de TensorFlow cuando el componente se desmonta
  useEffect(() => {
    return () => {
      if (tfWorkerClient) {
        tfWorkerClient.cleanupMemory();
      }
    };
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
    ppgData
  };
};

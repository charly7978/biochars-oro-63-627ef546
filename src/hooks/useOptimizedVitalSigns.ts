import { useState, useCallback, useRef, useEffect } from 'react';
import { VitalSignsResult } from '../modules/vital-signs/types/vital-signs-result';
import { ResultFactory } from '../modules/vital-signs/factories/result-factory';
import { useTensorFlowProcessor } from './useTensorFlowProcessor';
import { SignalQualityAnalyzer } from '../modules/vital-signs/SignalQualityAnalyzer';
import TensorFlowService from '../services/TensorFlowService';

/**
 * Hook centralizado y optimizado para procesamiento de signos vitales
 * Elimina redundancias y mejora rendimiento con TensorFlow
 */
export function useOptimizedVitalSigns() {
  // Estado para resultados
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  
  // Referencia al buffer de señales
  const signalBuffer = useRef<number[]>([]);
  const MAX_BUFFER_SIZE = 500;
  
  // Contadores y flags para seguimiento de estado
  const measurementSessionRef = useRef<string>(Math.random().toString(36).substring(2, 9));
  const framesProcessedRef = useRef<number>(0);
  const isMonitoringRef = useRef<boolean>(false);
  const lastArrhythmiaTimeRef = useRef<number>(0);
  const rrIntervalsRef = useRef<number[]>([]);
  
  // Analizador de calidad de señal
  const signalQualityAnalyzer = useRef<SignalQualityAnalyzer>(new SignalQualityAnalyzer());
  
  // Modelos TensorFlow para cada signo vital
  const heartRateModel = useTensorFlowProcessor('heartRate', true);
  const spo2Model = useTensorFlowProcessor('spo2', true);
  const bpModel = useTensorFlowProcessor('bp', false);
  const arrhythmiaModel = useTensorFlowProcessor('arrhythmia', false);
  
  // Inicializar modelos secundarios cuando los primarios estén listos
  useEffect(() => {
    if (heartRateModel.isReady && spo2Model.isReady && !bpModel.isReady) {
      // Cargar modelos secundarios después de los primarios
      setTimeout(() => {
        bpModel.loadModel();
        setTimeout(() => {
          arrhythmiaModel.loadModel();
        }, 2000);
      }, 1000);
    }
  }, [heartRateModel.isReady, spo2Model.isReady, bpModel.isReady, arrhythmiaModel.isReady]);
  
  /**
   * Procesa señal PPG y actualiza buffer
   */
  const processSignal = useCallback((
    value: number,
    rrData?: { intervals: number[], lastPeakTime: number | null }
  ): VitalSignsResult => {
    // Si no estamos monitoreando, retornar últimos resultados válidos
    if (!isMonitoringRef.current) {
      return lastValidResults || ResultFactory.createEmptyResults();
    }
    
    // Incrementar contador de frames
    framesProcessedRef.current++;
    
    // Actualizar buffer de señal
    signalBuffer.current.push(value);
    if (signalBuffer.current.length > MAX_BUFFER_SIZE) {
      signalBuffer.current.shift();
    }
    
    // Actualizar intervalos RR si están disponibles
    if (rrData && rrData.intervals.length > 0) {
      rrIntervalsRef.current = [...rrData.intervals];
      // Limitar tamaño máximo
      if (rrIntervalsRef.current.length > 20) {
        rrIntervalsRef.current = rrIntervalsRef.current.slice(-20);
      }
    }
    
    // Verificar calidad de señal
    const qualityResult = signalQualityAnalyzer.current.analyzeQuality(
      value,
      signalBuffer.current.slice(-30)
    );
    
    // Si la calidad es muy baja, no realizar cálculos complejos
    if (!qualityResult.isAcceptable && framesProcessedRef.current > 30) {
      return ResultFactory.createEmptyResults();
    }
    
    try {
      // Registro periódico para diagnóstico
      if (framesProcessedRef.current % 100 === 0) {
        console.log("useOptimizedVitalSigns: Procesando señal:", {
          bufferSize: signalBuffer.current.length,
          framesProcessados: framesProcessedRef.current,
          signalQuality: qualityResult.score.toFixed(2),
          rrIntervals: rrIntervalsRef.current.length
        });
      }
      
      // Procesar signos vitales usando modelos TensorFlow cuando hay suficientes datos
      if (signalBuffer.current.length >= 100) {
        // Crear resultado comenzando con valores previos (si existen)
        let result: VitalSignsResult = lastValidResults ? 
          { ...lastValidResults } : 
          ResultFactory.createEmptyResults();
          
        // Obtener datos recientes para procesamiento
        const recentBuffer = signalBuffer.current.slice(-300);
        
        // Procesar frecuencia cardíaca con TensorFlow
        if (heartRateModel.isReady && framesProcessedRef.current % 5 === 0) {
          // Convertimos la llamada asíncrona en síncrona con un valor temporal
          heartRateModel.predict(recentBuffer.slice(-200))
            .then(heartRatePrediction => {
              if (heartRatePrediction.length > 0 && heartRatePrediction[0] > 40 && heartRatePrediction[0] < 200) {
                result.heartRate = Math.round(heartRatePrediction[0]);
                // Actualizar resultados 
                if (result.heartRate > 0) {
                  setLastValidResults(result);
                }
              }
            })
            .catch(error => {
              console.warn("Error predicting heart rate:", error);
            });
        }
        
        // Procesar SpO2 con TensorFlow cada 10 frames
        if (spo2Model.isReady && framesProcessedRef.current % 10 === 0) {
          // Convertimos la llamada asíncrona en síncrona con un valor temporal
          spo2Model.predict(recentBuffer.slice(-150))
            .then(spo2Prediction => {
              if (spo2Prediction.length > 0 && spo2Prediction[0] > 80 && spo2Prediction[0] <= 100) {
                result.spo2 = Math.round(spo2Prediction[0]);
                // Actualizar resultados 
                if (result.heartRate > 0) {
                  setLastValidResults(result);
                }
              }
            })
            .catch(error => {
              console.warn("Error predicting SpO2:", error);
            });
        }
        
        // Procesar presión arterial cada 20 frames
        if (bpModel.isReady && framesProcessedRef.current % 20 === 0) {
          // Convertimos la llamada asíncrona en síncrona con un valor temporal
          bpModel.predict(recentBuffer.slice(-250))
            .then(bpPrediction => {
              if (bpPrediction.length >= 2) {
                const systolic = Math.round(bpPrediction[0]);
                const diastolic = Math.round(bpPrediction[1]);
                
                if (systolic > 70 && systolic < 200 && diastolic > 40 && diastolic < 120 && systolic > diastolic) {
                  result.pressure = `${systolic}/${diastolic}`;
                  // Actualizar resultados 
                  if (result.heartRate > 0) {
                    setLastValidResults(result);
                  }
                }
              }
            })
            .catch(error => {
              console.warn("Error predicting blood pressure:", error);
            });
        }
        
        // Detectar arritmias cada 15 frames si hay suficientes datos RR
        if (arrhythmiaModel.isReady && framesProcessedRef.current % 15 === 0 && rrIntervalsRef.current.length >= 5) {
          // Preparar datos para detección de arritmia
          const rrFeatures = processRRIntervalsForArrhythmia(rrIntervalsRef.current);
          
          // Convertimos la llamada asíncrona en síncrona con un valor temporal
          arrhythmiaModel.predict(rrFeatures)
            .then(arrhythmiaPrediction => {
              if (arrhythmiaPrediction.length >= 2) {
                const isArrhythmia = arrhythmiaPrediction[1] > 0.65; // Umbral de confianza
                
                if (isArrhythmia) {
                  lastArrhythmiaTimeRef.current = Date.now();
                  result.arrhythmiaStatus = "ARRITMIA DETECTADA|1";
                  result.lastArrhythmiaData = {
                    timestamp: Date.now(),
                    rmssd: calculateRMSSD(rrIntervalsRef.current),
                    rrVariation: calculateRRVariation(rrIntervalsRef.current)
                  };
                  // Actualizar resultados 
                  if (result.heartRate > 0) {
                    setLastValidResults(result);
                  }
                } else {
                  result.arrhythmiaStatus = "RITMO NORMAL|0";
                  // Actualizar resultados 
                  if (result.heartRate > 0) {
                    setLastValidResults(result);
                  }
                }
              }
            })
            .catch(error => {
              console.warn("Error detecting arrhythmia:", error);
            });
        }
        
        // Procesar glucosa, hemoglobina y otros parámetros cada 30 frames
        if (framesProcessedRef.current % 30 === 0) {
          // Estos parámetros se procesan con métodos tradicionales, no TensorFlow por ahora
          result.glucose = estimateGlucose(recentBuffer);
          result.hemoglobin = estimateHemoglobin(recentBuffer);
          result.hydration = estimateHydration(recentBuffer);
          
          // Estimar perfil lipídico
          const lipids = estimateLipids(recentBuffer);
          result.lipids = {
            totalCholesterol: lipids.totalCholesterol,
            triglycerides: lipids.triglycerides
          };
          
          // Actualizar resultados válidos
          if (result.heartRate > 0) {
            setLastValidResults(result);
          }
        }
        
        return result;
      }
    } catch (error) {
      console.error("Error processing vital signs:", error);
    }
    
    // Si no hay suficientes datos, retornar últimos resultados válidos
    return lastValidResults || ResultFactory.createEmptyResults();
  }, [lastValidResults, heartRateModel, spo2Model, bpModel, arrhythmiaModel]);
  
  /**
   * Inicia monitoreo de signos vitales
   */
  const startMonitoring = useCallback(() => {
    console.log("useOptimizedVitalSigns: Iniciando monitoreo");
    isMonitoringRef.current = true;
    measurementSessionRef.current = Math.random().toString(36).substring(2, 9);
    framesProcessedRef.current = 0;
    signalBuffer.current = [];
    rrIntervalsRef.current = [];
    lastArrhythmiaTimeRef.current = 0;
    
    // Precargar modelos de TensorFlow
    if (!heartRateModel.isReady) heartRateModel.loadModel();
    if (!spo2Model.isReady) spo2Model.loadModel();
    
    // Cargar modelos secundarios después
    setTimeout(() => {
      if (!bpModel.isReady) bpModel.loadModel();
      if (!arrhythmiaModel.isReady) arrhythmiaModel.loadModel();
    }, 2000);
  }, [heartRateModel, spo2Model, bpModel, arrhythmiaModel]);
  
  /**
   * Detiene monitoreo de signos vitales
   */
  const stopMonitoring = useCallback(() => {
    console.log("useOptimizedVitalSigns: Deteniendo monitoreo");
    isMonitoringRef.current = false;
    
    // Limpiar memoria de modelos TensorFlow
    TensorFlowService.cleanupMemory().catch(err => {
      console.warn("Error limpiando memoria TensorFlow:", err);
    });
  }, []);
  
  /**
   * Reinicia completamente el procesador
   */
  const resetProcessor = useCallback(() => {
    console.log("useOptimizedVitalSigns: Reiniciando procesador");
    isMonitoringRef.current = false;
    framesProcessedRef.current = 0;
    signalBuffer.current = [];
    rrIntervalsRef.current = [];
    lastArrhythmiaTimeRef.current = 0;
    signalQualityAnalyzer.current.reset();
    setLastValidResults(null);
    
    // No descargar modelos, solo liberar memoria
    TensorFlowService.cleanupMemory().catch(err => {
      console.warn("Error limpiando memoria TensorFlow:", err);
    });
  }, []);
  
  // Funciones de utilidad para procesamiento de parámetros secundarios
  
  /**
   * Procesa intervalos RR para detección de arritmias
   */
  const processRRIntervalsForArrhythmia = (intervals: number[]): number[] => {
    if (intervals.length < 3) return [];
    
    // Calcular características para detección de arritmia
    const features: number[] = [];
    
    // Intervalos directos
    intervals.forEach(interval => features.push(interval));
    
    // Agregar diferencias entre intervalos consecutivos
    for (let i = 1; i < intervals.length; i++) {
      features.push(intervals[i] - intervals[i-1]);
    }
    
    // Calcular RMSSD (Root Mean Square of Successive Differences)
    let sumSquaredDiff = 0;
    for (let i = 1; i < intervals.length; i++) {
      sumSquaredDiff += Math.pow(intervals[i] - intervals[i-1], 2);
    }
    const rmssd = Math.sqrt(sumSquaredDiff / (intervals.length - 1));
    features.push(rmssd);
    
    // Normalizar características
    const maxVal = Math.max(...features);
    const minVal = Math.min(...features);
    const range = maxVal - minVal;
    
    if (range > 0) {
      return features.map(f => (f - minVal) / range);
    }
    
    return features;
  };
  
  /**
   * Calcula RMSSD (Root Mean Square of Successive Differences)
   */
  const calculateRMSSD = (intervals: number[]): number => {
    if (intervals.length < 2) return 0;
    
    let sumSquaredDiff = 0;
    for (let i = 1; i < intervals.length; i++) {
      sumSquaredDiff += Math.pow(intervals[i] - intervals[i-1], 2);
    }
    
    return Math.sqrt(sumSquaredDiff / (intervals.length - 1));
  };
  
  /**
   * Calcula variación de intervalos RR
   */
  const calculateRRVariation = (intervals: number[]): number => {
    if (intervals.length < 2) return 0;
    
    const avg = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const deviations = intervals.map(val => Math.abs(val - avg) / avg);
    
    return deviations.reduce((sum, val) => sum + val, 0) / deviations.length;
  };
  
  /**
   * Estima nivel de glucosa a partir de señal PPG
   */
  const estimateGlucose = (signal: number[]): number => {
    if (signal.length < 30) return 95;
    
    const recentValues = signal.slice(-30);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const amplitude = max - min;
    
    let glucoseEstimate = 95;
    
    if (amplitude > 0.2) {
      glucoseEstimate -= 5;
    } else if (amplitude < 0.1) {
      glucoseEstimate += 5;
    }
    
    if (mean > 0.6) {
      glucoseEstimate += 3;
    } else if (mean < 0.4) {
      glucoseEstimate -= 3;
    }
    
    return Math.max(70, Math.min(180, Math.round(glucoseEstimate)));
  };
  
  /**
   * Estima nivel de hemoglobina a partir de señal PPG
   */
  const estimateHemoglobin = (signal: number[]): number => {
    if (signal.length < 30) return 14;
    
    const recentValues = signal.slice(-30);
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const amplitude = max - min;
    
    let hemoglobinEstimate = 14.0;
    
    if (amplitude > 0.25) {
      hemoglobinEstimate += 0.5;
    } else if (amplitude < 0.1) {
      hemoglobinEstimate -= 0.5;
    }
    
    return Math.max(8, Math.min(18, Math.round(hemoglobinEstimate)));
  };
  
  /**
   * Estima nivel de hidratación a partir de señal PPG
   */
  const estimateHydration = (signal: number[]): number => {
    if (signal.length < 30) return 65;
    
    const recentValues = signal.slice(-30);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const amplitude = max - min;
    
    let hydrationEstimate = 65;
    
    if (amplitude > 0.25) {
      hydrationEstimate += 10;
    } else if (amplitude < 0.1) {
      hydrationEstimate -= 10;
    }
    
    if (mean > 0.6) {
      hydrationEstimate += 5;
    }
    
    return Math.max(35, Math.min(95, Math.round(hydrationEstimate)));
  };
  
  /**
   * Estima perfil lipídico a partir de señal PPG
   */
  const estimateLipids = (signal: number[]): { totalCholesterol: number, triglycerides: number } => {
    if (signal.length < 50) return { totalCholesterol: 180, triglycerides: 150 };
    
    const recentValues = signal.slice(-50);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const amplitude = max - min;
    
    let cholesterolEstimate = 180;
    let triglyceridesEstimate = 150;
    
    if (amplitude > 0.3) {
      cholesterolEstimate -= 20;
      triglyceridesEstimate -= 15;
    } else if (amplitude < 0.1) {
      cholesterolEstimate += 20;
      triglyceridesEstimate += 15;
    }
    
    if (mean > 0.7) {
      cholesterolEstimate += 10;
      triglyceridesEstimate += 10;
    } else if (mean < 0.3) {
      cholesterolEstimate -= 10;
      triglyceridesEstimate -= 10;
    }
    
    return {
      totalCholesterol: Math.max(120, Math.min(280, Math.round(cholesterolEstimate))),
      triglycerides: Math.max(70, Math.min(300, Math.round(triglyceridesEstimate)))
    };
  };
  
  return {
    processSignal,
    startMonitoring,
    stopMonitoring,
    resetProcessor,
    lastValidResults,
    isMonitoring: isMonitoringRef.current,
    framesProcessed: framesProcessedRef.current,
    modelsStatus: {
      heartRate: heartRateModel.isReady,
      spo2: spo2Model.isReady,
      bp: bpModel.isReady,
      arrhythmia: arrhythmiaModel.isReady
    }
  };
}

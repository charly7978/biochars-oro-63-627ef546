
import { useState, useCallback, useRef, useEffect } from 'react';
import { VitalSignsProcessor, VitalSignsResult } from '../modules/vital-signs/VitalSignsProcessor';
import { analyzeRRIntervals, logRRAnalysis, logPossibleArrhythmia, logConfirmedArrhythmia, logIgnoredArrhythmia } from '../utils/rrAnalysisUtils';
import { startCalibration as startCalibrationUtil, forceCalibrationCompletion as forceCalibrationCompletionUtil, logSignalProcessing, logValidResults } from '../utils/calibrationUtils';
import { updateSignalLog } from '../utils/signalLogUtils';

/**
 * Custom hook for processing vital signs with advanced algorithms
 * Uses improved signal processing and arrhythmia detection based on medical research
 */
export const useVitalSignsProcessor = () => {
  // State and refs
  const [processor] = useState(() => {
    console.log("useVitalSignsProcessor: Creando nueva instancia", {
      timestamp: new Date().toISOString()
    });
    return new VitalSignsProcessor();
  });
  const [arrhythmiaCounter, setArrhythmiaCounter] = useState(0);
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  const lastArrhythmiaTime = useRef<number>(0);
  const hasDetectedArrhythmia = useRef<boolean>(false);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const processedSignals = useRef<number>(0);
  const signalLog = useRef<{timestamp: number, value: number, result: any}[]>([]);
  
  // Advanced configuration based on clinical guidelines
  const MIN_TIME_BETWEEN_ARRHYTHMIAS = 1000; // Minimum 1 second between arrhythmias
  const MAX_ARRHYTHMIAS_PER_SESSION = 20; // Reasonable maximum for 30 seconds
  const SIGNAL_QUALITY_THRESHOLD = 0.55; // Signal quality required for reliable detection
  
  useEffect(() => {
    console.log("useVitalSignsProcessor: Hook inicializado", {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString(),
      parametros: {
        MIN_TIME_BETWEEN_ARRHYTHMIAS,
        MAX_ARRHYTHMIAS_PER_SESSION,
        SIGNAL_QUALITY_THRESHOLD
      }
    });
    
    return () => {
      console.log("useVitalSignsProcessor: Hook destruido", {
        sessionId: sessionId.current,
        arritmiasTotales: arrhythmiaCounter,
        señalesProcesadas: processedSignals.current,
        timestamp: new Date().toISOString()
      });
    };
  }, []);
  
  /**
   * Start calibration for all vital signs
   */
  const startCalibration = useCallback(() => {
    startCalibrationUtil(processor);
  }, [processor]);
  
  /**
   * Force calibration to complete immediately
   */
  const forceCalibrationCompletion = useCallback(() => {
    forceCalibrationCompletionUtil(processor);
  }, [processor]);
  
  // Process the signal with improved algorithms
  const processSignal = useCallback((value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => {
    processedSignals.current++;
    
    // Log signal processing
    logSignalProcessing(value, rrData, arrhythmiaCounter, processedSignals.current, sessionId.current, processor);
    
    // Process signal through the vital signs processor
    const result = processor.processSignal(value, rrData);
    const currentTime = Date.now();
    
    // Actualizar log de señales
    signalLog.current = updateSignalLog(signalLog.current, currentTime, value, result, processedSignals.current);
    
    // Si tenemos un resultado válido, guárdalo
    if (result.spo2 > 0 && result.glucose > 0 && result.lipids.totalCholesterol > 0) {
      logValidResults(result);
      setLastValidResults(result);
    }
    
    // Análisis de intervalos RR para detección de arritmias
    if (rrData?.intervals && rrData.intervals.length >= 3) {
      const lastThreeIntervals = rrData.intervals.slice(-3);
      
      // Analizar intervalos RR para detectar posibles arritmias
      const { hasArrhythmia, shouldIncrementCounter, analysisData } = 
        analyzeRRIntervals(
          rrData, 
          currentTime, 
          lastArrhythmiaTime.current, 
          arrhythmiaCounter,
          MIN_TIME_BETWEEN_ARRHYTHMIAS,
          MAX_ARRHYTHMIAS_PER_SESSION
        );
      
      if (analysisData) {
        // Registrar análisis RR para depuración
        logRRAnalysis(analysisData, lastThreeIntervals);
        
        // Si se detecta una posible arritmia, registrar detalles
        if (hasArrhythmia) {
          logPossibleArrhythmia(analysisData);
          
          if (shouldIncrementCounter) {
            // Confirmamos la arritmia e incrementamos el contador
            hasDetectedArrhythmia.current = true;
            const nuevoContador = arrhythmiaCounter + 1;
            setArrhythmiaCounter(nuevoContador);
            lastArrhythmiaTime.current = currentTime;
            
            // Registrar la arritmia confirmada
            logConfirmedArrhythmia(analysisData, lastThreeIntervals, nuevoContador);

            return {
              ...result,
              arrhythmiaStatus: `ARRITMIA DETECTADA|${nuevoContador}`,
              lastArrhythmiaData: {
                timestamp: currentTime,
                rmssd: analysisData.rmssd,
                rrVariation: analysisData.rrVariation
              }
            };
          } else {
            // Arritmia detectada pero ignorada (demasiado reciente o máximo alcanzado)
            logIgnoredArrhythmia(
              currentTime - lastArrhythmiaTime.current,
              MAX_ARRHYTHMIAS_PER_SESSION,
              arrhythmiaCounter
            );
          }
        }
      }
    }
    
    // If we previously detected an arrhythmia, maintain that state
    if (hasDetectedArrhythmia.current) {
      return {
        ...result,
        arrhythmiaStatus: `ARRITMIA DETECTADA|${arrhythmiaCounter}`,
        lastArrhythmiaData: null
      };
    }
    
    // No arrhythmias detected
    return {
      ...result,
      arrhythmiaStatus: `SIN ARRITMIAS|${arrhythmiaCounter}`
    };
  }, [processor, arrhythmiaCounter]);

  // Soft reset: mantener los resultados pero reiniciar los procesadores
  const reset = useCallback(() => {
    console.log("useVitalSignsProcessor: Reseteo suave", {
      estadoAnterior: {
        arritmias: arrhythmiaCounter,
        últimosResultados: lastValidResults ? {
          spo2: lastValidResults.spo2,
          presión: lastValidResults.pressure
        } : null
      },
      timestamp: new Date().toISOString()
    });
    
    const savedResults = processor.reset();
    if (savedResults) {
      console.log("useVitalSignsProcessor: Guardando resultados tras reset", {
        resultadosGuardados: {
          spo2: savedResults.spo2,
          presión: savedResults.pressure,
          estadoArritmia: savedResults.arrhythmiaStatus
        },
        timestamp: new Date().toISOString()
      });
      
      setLastValidResults(savedResults);
    } else {
      console.log("useVitalSignsProcessor: No hay resultados para guardar tras reset", {
        timestamp: new Date().toISOString()
      });
    }
    
    setArrhythmiaCounter(0);
    lastArrhythmiaTime.current = 0;
    hasDetectedArrhythmia.current = false;
    console.log("Reseteo suave completado - manteniendo resultados");
    return savedResults;
  }, [processor]);
  
  // Hard reset: borrar todos los resultados y reiniciar
  const fullReset = useCallback(() => {
    console.log("useVitalSignsProcessor: Reseteo completo", {
      estadoAnterior: {
        arritmias: arrhythmiaCounter,
        últimosResultados: lastValidResults ? {
          spo2: lastValidResults.spo2,
          presión: lastValidResults.pressure
        } : null,
        señalesProcesadas: processedSignals.current
      },
      timestamp: new Date().toISOString()
    });
    
    processor.fullReset();
    setLastValidResults(null);
    setArrhythmiaCounter(0);
    lastArrhythmiaTime.current = 0;
    hasDetectedArrhythmia.current = false;
    processedSignals.current = 0;
    signalLog.current = [];
    console.log("Reseteo completo finalizado - borrando todos los resultados");
  }, [processor, arrhythmiaCounter, lastValidResults]);

  return {
    processSignal,
    reset,
    fullReset,
    startCalibration,
    forceCalibrationCompletion,
    arrhythmiaCounter,
    lastValidResults,
    debugInfo: {
      processedSignals: processedSignals.current,
      signalLog: signalLog.current.slice(-10)
    }
  };
};

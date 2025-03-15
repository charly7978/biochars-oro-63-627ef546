
import { useState, useCallback, useRef, useEffect } from 'react';
import { VitalSignsProcessor, VitalSignsResult } from '../modules/vital-signs/VitalSignsProcessor';
import { 
  analyzeRRIntervals, 
  logRRAnalysis, 
  logPossibleArrhythmia, 
  logConfirmedArrhythmia, 
  logIgnoredArrhythmia 
} from '../utils/rrAnalysisUtils';
import { updateSignalLog } from '../utils/signalLogUtils';

/**
 * Configuración para detección de arritmias
 */
interface ArrhythmiaConfig {
  MIN_TIME_BETWEEN_ARRHYTHMIAS: number;
  MAX_ARRHYTHMIAS_PER_SESSION: number;
  SIGNAL_QUALITY_THRESHOLD: number;
}

/**
 * Custom hook para procesar signos vitales con algoritmos avanzados
 * Usa procesamiento de señal mejorado y detección de arritmias basada en investigación médica
 */
export const useVitalSignsProcessor = () => {
  // State y refs
  const [processor] = useState(() => {
    console.log("useVitalSignsProcessor: Creando nueva instancia", {
      timestamp: new Date().toISOString()
    });
    return new VitalSignsProcessor();
  });
  
  const [arrhythmiaCounter, setArrhythmiaCounter] = useState(0);
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  
  // Referencias para estado interno
  const lastArrhythmiaTime = useRef<number>(0);
  const hasDetectedArrhythmia = useRef<boolean>(false);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const processedSignals = useRef<number>(0);
  const signalLog = useRef<{timestamp: number, value: number, result: any}[]>([]);
  
  // Configuración avanzada basada en guías clínicas
  const arrhythmiaConfig = useRef<ArrhythmiaConfig>({
    MIN_TIME_BETWEEN_ARRHYTHMIAS: 1000, // Mínimo 1 segundo entre arritmias
    MAX_ARRHYTHMIAS_PER_SESSION: 20, // Máximo razonable para 30 segundos
    SIGNAL_QUALITY_THRESHOLD: 0.55 // Calidad de señal requerida para detección confiable
  });
  
  // Inicialización y limpieza
  useEffect(() => {
    console.log("useVitalSignsProcessor: Hook inicializado", {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString(),
      parametros: { ...arrhythmiaConfig.current }
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
   * Procesa datos de arritmia basado en intervalos RR
   */
  const processArrhythmiaData = useCallback((
    rrData: { intervals: number[], lastPeakTime: number | null } | undefined,
    result: VitalSignsResult
  ): VitalSignsResult => {
    const currentTime = Date.now();
    
    // Si no hay datos RR válidos, retornar el resultado sin cambios
    if (!rrData?.intervals || rrData.intervals.length < 3) {
      // Si previamente detectamos una arritmia, mantener ese estado
      if (hasDetectedArrhythmia.current) {
        return {
          ...result,
          arrhythmiaStatus: `ARRITMIA DETECTADA|${arrhythmiaCounter}`,
          lastArrhythmiaData: null
        };
      }
      
      return {
        ...result,
        arrhythmiaStatus: `SIN ARRITMIAS|${arrhythmiaCounter}`
      };
    }
    
    const lastThreeIntervals = rrData.intervals.slice(-3);
    
    // Analizar intervalos RR para detectar posibles arritmias
    const { hasArrhythmia, shouldIncrementCounter, analysisData } = 
      analyzeRRIntervals(
        rrData, 
        currentTime, 
        lastArrhythmiaTime.current, 
        arrhythmiaCounter,
        arrhythmiaConfig.current.MIN_TIME_BETWEEN_ARRHYTHMIAS,
        arrhythmiaConfig.current.MAX_ARRHYTHMIAS_PER_SESSION
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
            arrhythmiaConfig.current.MAX_ARRHYTHMIAS_PER_SESSION,
            arrhythmiaCounter
          );
        }
      }
    }
    
    // Si previamente detectamos una arritmia, mantener ese estado
    if (hasDetectedArrhythmia.current) {
      return {
        ...result,
        arrhythmiaStatus: `ARRITMIA DETECTADA|${arrhythmiaCounter}`,
        lastArrhythmiaData: null
      };
    }
    
    // No se detectaron arritmias
    return {
      ...result,
      arrhythmiaStatus: `SIN ARRITMIAS|${arrhythmiaCounter}`
    };
  }, [arrhythmiaCounter]);
  
  /**
   * Procesa la señal con algoritmos mejorados
   */
  const processSignal = useCallback((value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => {
    processedSignals.current++;
    
    // Registrar procesamiento de señal
    console.log("useVitalSignsProcessor: Procesando señal", {
      valorEntrada: value,
      rrDataPresente: !!rrData,
      intervalosRR: rrData?.intervals.length || 0,
      ultimosIntervalos: rrData?.intervals.slice(-3) || [],
      contadorArritmias: arrhythmiaCounter,
      señalNúmero: processedSignals.current,
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    // Procesar señal a través del procesador de signos vitales
    let result = processor.processSignal(value, rrData);
    const currentTime = Date.now();
    
    // Procesar datos de arritmia si están disponibles
    result = processArrhythmiaData(rrData, result);
    
    // Actualizar log de señales
    signalLog.current = updateSignalLog(signalLog.current, currentTime, value, result, processedSignals.current);
    
    // Si tenemos un resultado válido, guardarlo
    if (result.spo2 > 0 && result.glucose > 0 && result.lipids.totalCholesterol > 0) {
      console.log("useVitalSignsProcessor: Resultado válido detectado", {
        spo2: result.spo2,
        presión: result.pressure,
        glucosa: result.glucose,
        lípidos: result.lipids,
        timestamp: new Date().toISOString()
      });
      setLastValidResults(result);
    }
    
    return result;
  }, [processor, arrhythmiaCounter, processArrhythmiaData]);

  /**
   * Soft reset: mantener los resultados pero reiniciar los procesadores
   */
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
  
  /**
   * Hard reset: borrar todos los resultados y reiniciar
   */
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
    arrhythmiaCounter,
    lastValidResults,
    debugInfo: {
      processedSignals: processedSignals.current,
      signalLog: signalLog.current.slice(-10)
    }
  };
};


import { useState, useCallback, useRef, useEffect } from 'react';
import { VitalSignsProcessor, VitalSignsResult } from '../modules/vital-signs/VitalSignsProcessor';
import { updateSignalLog } from '../utils/signalLogUtils';
import { ArrhythmiaAnalyzer, ArrhythmiaConfig } from './arrhythmia/arrhythmiaAnalysis';

/**
 * Custom hook para procesar signos vitales con algoritmos avanzados
 * Usa procesamiento de señal mejorado y detección de arritmias basada en investigación médica
 */
export const useVitalSignsProcessor = () => {
  // State
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  
  // Referencias para estado interno
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const arrhythmiaAnalyzerRef = useRef<ArrhythmiaAnalyzer | null>(null);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const processedSignals = useRef<number>(0);
  const signalLog = useRef<{timestamp: number, value: number, result: any}[]>([]);
  
  // Configuración avanzada basada en guías clínicas
  const arrhythmiaConfig = useRef<ArrhythmiaConfig>({
    MIN_TIME_BETWEEN_ARRHYTHMIAS: 1000, // Mínimo 1 segundo entre arritmias
    MAX_ARRHYTHMIAS_PER_SESSION: 20, // Máximo razonable para 30 segundos
    SIGNAL_QUALITY_THRESHOLD: 0.55 // Calidad de señal requerida para detección confiable
  });
  
  // Inicialización
  useEffect(() => {
    processorRef.current = new VitalSignsProcessor();
    arrhythmiaAnalyzerRef.current = new ArrhythmiaAnalyzer(arrhythmiaConfig.current);
    
    console.log("useVitalSignsProcessor: Hook inicializado", {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString(),
      parametros: { ...arrhythmiaConfig.current }
    });
    
    return () => {
      console.log("useVitalSignsProcessor: Hook destruido", {
        sessionId: sessionId.current,
        arritmiasTotales: arrhythmiaAnalyzerRef.current?.getArrhythmiaCounter() || 0,
        señalesProcesadas: processedSignals.current,
        timestamp: new Date().toISOString()
      });
    };
  }, []);
  
  /**
   * Procesa la señal con algoritmos mejorados
   */
  const processSignal = useCallback((value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => {
    if (!processorRef.current || !arrhythmiaAnalyzerRef.current) return {
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: "--",
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      }
    };
    
    processedSignals.current++;
    
    // Registrar procesamiento de señal
    console.log("useVitalSignsProcessor: Procesando señal", {
      valorEntrada: value,
      rrDataPresente: !!rrData,
      intervalosRR: rrData?.intervals.length || 0,
      ultimosIntervalos: rrData?.intervals.slice(-3) || [],
      contadorArritmias: arrhythmiaAnalyzerRef.current.getArrhythmiaCounter(),
      señalNúmero: processedSignals.current,
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    // Procesar señal a través del procesador de signos vitales
    let result = processorRef.current.processSignal(value, rrData);
    const currentTime = Date.now();
    
    // Procesar datos de arritmia si están disponibles
    result = arrhythmiaAnalyzerRef.current.processArrhythmiaData(rrData, result);
    
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
  }, []);

  /**
   * Soft reset: mantener los resultados pero reiniciar los procesadores
   */
  const reset = useCallback(() => {
    if (!processorRef.current || !arrhythmiaAnalyzerRef.current) return null;
    
    console.log("useVitalSignsProcessor: Reseteo suave", {
      estadoAnterior: {
        arritmias: arrhythmiaAnalyzerRef.current.getArrhythmiaCounter(),
        últimosResultados: lastValidResults ? {
          spo2: lastValidResults.spo2,
          presión: lastValidResults.pressure
        } : null
      },
      timestamp: new Date().toISOString()
    });
    
    const savedResults = processorRef.current.reset();
    arrhythmiaAnalyzerRef.current.reset();
    
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
    
    console.log("Reseteo suave completado - manteniendo resultados");
    return savedResults;
  }, [lastValidResults]);
  
  /**
   * Hard reset: borrar todos los resultados y reiniciar
   */
  const fullReset = useCallback(() => {
    if (!processorRef.current || !arrhythmiaAnalyzerRef.current) return;
    
    console.log("useVitalSignsProcessor: Reseteo completo", {
      estadoAnterior: {
        arritmias: arrhythmiaAnalyzerRef.current.getArrhythmiaCounter(),
        últimosResultados: lastValidResults ? {
          spo2: lastValidResults.spo2,
          presión: lastValidResults.pressure
        } : null,
        señalesProcesadas: processedSignals.current
      },
      timestamp: new Date().toISOString()
    });
    
    processorRef.current.fullReset();
    arrhythmiaAnalyzerRef.current.reset();
    setLastValidResults(null);
    processedSignals.current = 0;
    signalLog.current = [];
    console.log("Reseteo completo finalizado - borrando todos los resultados");
  }, [processorRef, lastValidResults]);

  return {
    processSignal,
    reset,
    fullReset,
    arrhythmiaCounter: arrhythmiaAnalyzerRef.current?.getArrhythmiaCounter() || 0,
    lastValidResults,
    debugInfo: {
      processedSignals: processedSignals.current,
      signalLog: signalLog.current.slice(-10)
    }
  };
};

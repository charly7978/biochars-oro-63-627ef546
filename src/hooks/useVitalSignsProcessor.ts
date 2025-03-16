
import { useState, useCallback, useRef, useEffect } from 'react';
import { VitalSignsProcessor, VitalSignsResult } from '../modules/vital-signs/VitalSignsProcessor';
import { updateSignalLog } from '../utils/signalLogUtils';
import { ArrhythmiaAnalyzer, ArrhythmiaConfig } from './arrhythmia/arrhythmiaAnalysis';

interface ArrhythmiaWindow {
  start: number;
  end: number;
}

/**
 * Custom hook para procesar signos vitales con algoritmos ultra conservadores
 * Enfocado en minimizar falsos positivos por encima de todo
 */
export const useVitalSignsProcessor = () => {
  // State
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  const [arrhythmiaWindows, setArrhythmiaWindows] = useState<ArrhythmiaWindow[]>([]);
  
  // Referencias para estado interno
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const arrhythmiaAnalyzerRef = useRef<ArrhythmiaAnalyzer | null>(null);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const processedSignals = useRef<number>(0);
  const signalLog = useRef<{timestamp: number, value: number, result: any}[]>([]);
  
  // Configuración ultra conservadora para minimizar falsos positivos
  const arrhythmiaConfig = useRef<ArrhythmiaConfig>({
    // Tiempo extremadamente largo entre arritmias
    MIN_TIME_BETWEEN_ARRHYTHMIAS: 15000, // 15 segundos entre arritmias
    // Limitado a una sola arritmia por sesión para ser ultra conservador
    MAX_ARRHYTHMIAS_PER_SESSION: 1,
    // Requerimos calidad óptima para detección
    SIGNAL_QUALITY_THRESHOLD: 0.98
  });
  
  // Inicialización
  useEffect(() => {
    processorRef.current = new VitalSignsProcessor();
    arrhythmiaAnalyzerRef.current = new ArrhythmiaAnalyzer(arrhythmiaConfig.current);
    
    console.log("useVitalSignsProcessor: Hook inicializado con configuración ultra conservadora", {
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
   * Registra una nueva ventana de arritmia - extremadamente reducida
   */
  const addArrhythmiaWindow = useCallback((start: number, end: number) => {
    // Limitamos a 1 sola ventana de arritmia (la más reciente)
    setArrhythmiaWindows([{ start, end }]);
  }, []);
  
  /**
   * Procesa la señal con algoritmos ultra conservadores
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
    
    // Si se detectó arritmia y tenemos datos, registrar la ventana de arritmia
    // Ventana muy corta (300ms) para minimizar impacto visual
    if (result.arrhythmiaStatus.includes("ARRITMIA DETECTADA") && result.lastArrhythmiaData) {
      const arrhythmiaTime = result.lastArrhythmiaData.timestamp;
      addArrhythmiaWindow(arrhythmiaTime - 150, arrhythmiaTime + 150);
    }
    
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
  }, [addArrhythmiaWindow]);

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
    setArrhythmiaWindows([]);
    
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
    setArrhythmiaWindows([]);
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
    arrhythmiaWindows,
    debugInfo: {
      processedSignals: processedSignals.current,
      signalLog: signalLog.current.slice(-10)
    }
  };
};

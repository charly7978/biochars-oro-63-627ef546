import { useState, useCallback, useRef, useEffect } from 'react';
import { VitalSignsProcessor, VitalSignsResult } from '../modules/vital-signs/VitalSignsProcessor';
import { updateSignalLog } from '../utils/signalLogUtils';
import { ArrhythmiaAnalyzer, ArrhythmiaConfig } from './arrhythmia/arrhythmiaAnalysis';

interface ArrhythmiaWindow {
  start: number;
  end: number;
}

/**
 * Custom hook para procesar signos vitales con algoritmos avanzados
 * Usa procesamiento de señal mejorado y detección de arritmias basada en investigación médica
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
  
  // Configuración ultra estricta para eliminar falsos positivos
  const arrhythmiaConfig = useRef<ArrhythmiaConfig>({
    // Aumentamos drásticamente el tiempo mínimo entre arritmias
    MIN_TIME_BETWEEN_ARRHYTHMIAS: 12000, // Aumentado de 8000ms a 12000ms
    MAX_ARRHYTHMIAS_PER_SESSION: 2,     // Reducido a solo 2 para ser extremadamente selectivos
    SIGNAL_QUALITY_THRESHOLD: 0.95      // Exigimos calidad prácticamente perfecta
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
   * Registra una nueva ventana de arritmia - DRÁSTICAMENTE reducida para evitar falsos positivos
   */
  const addArrhythmiaWindow = useCallback((start: number, end: number) => {
    // Limitamos a las últimas 2 ventanas de arritmias para evitar que todo se vuelva rojo
    setArrhythmiaWindows(prev => {
      const newWindows = [...prev, { start, end }];
      // Solo mantenemos las 2 ventanas más recientes
      return newWindows.slice(-2);
    });
  }, []);
  
  /**
   * Procesa la señal con algoritmos extremadamente mejorados
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
    // DRÁSTICAMENTE MEJORADO para minimizar falsos positivos
    if (result.arrhythmiaStatus.includes("ARRITMIA DETECTADA") && result.lastArrhythmiaData) {
      const arrhythmiaTime = result.lastArrhythmiaData.timestamp;
      // Crear una ventana aún más corta: 400ms en total (antes era 600ms)
      addArrhythmiaWindow(arrhythmiaTime - 200, arrhythmiaTime + 200);
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

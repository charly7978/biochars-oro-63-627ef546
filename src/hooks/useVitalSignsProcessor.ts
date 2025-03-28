
import { useState, useCallback, useRef, useEffect } from 'react';
import { VitalSignsProcessor, VitalSignsResult } from '../modules/vital-signs/VitalSignsProcessor';
import { updateSignalLog } from '../utils/signalLogUtils';

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
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const processedSignals = useRef<number>(0);
  const signalLog = useRef<{timestamp: number, value: number, result: any}[]>([]);
  
  // Inicialización
  useEffect(() => {
    processorRef.current = new VitalSignsProcessor();
    
    console.log("useVitalSignsProcessor: Hook inicializado", {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    return () => {
      console.log("useVitalSignsProcessor: Hook destruido", {
        sessionId: sessionId.current,
        señalesProcesadas: processedSignals.current,
        timestamp: new Date().toISOString()
      });
    };
  }, []);
  
  /**
   * Procesa la señal con algoritmos mejorados
   */
  const processSignal = useCallback((value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => {
    if (!processorRef.current) return {
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: "--"
    };
    
    processedSignals.current++;
    
    // Registrar procesamiento de señal
    console.log("useVitalSignsProcessor: Procesando señal", {
      valorEntrada: value,
      rrDataPresente: !!rrData,
      intervalosRR: rrData?.intervals.length || 0,
      ultimosIntervalos: rrData?.intervals.slice(-3) || [],
      señalNúmero: processedSignals.current,
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    // Procesar señal a través del procesador de signos vitales
    const result = processorRef.current.processSignal(value, rrData);
    const currentTime = Date.now();
    
    // Si se detectó arritmia y tenemos datos de ventana visual, actualizar ventanas de arritmia
    if (result.visualWindow) {
      // Actualizar ventanas de arritmia para visualización
      setArrhythmiaWindows(prev => {
        const newWindows = [...prev, { 
          start: result.visualWindow!.start, 
          end: result.visualWindow!.end 
        }];
        // Solo mantenemos las 3 ventanas más recientes
        return newWindows.slice(-3);
      });
    }
    
    // Actualizar log de señales
    signalLog.current = updateSignalLog(signalLog.current, currentTime, value, result, processedSignals.current);
    
    // Si tenemos un resultado válido, guardarlo
    if (result.spo2 > 0) {
      console.log("useVitalSignsProcessor: Resultado válido detectado", {
        spo2: result.spo2,
        presión: result.pressure,
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
    if (!processorRef.current) return null;
    
    console.log("useVitalSignsProcessor: Reseteo suave", {
      estadoAnterior: {
        últimosResultados: lastValidResults ? {
          spo2: lastValidResults.spo2,
          presión: lastValidResults.pressure
        } : null
      },
      timestamp: new Date().toISOString()
    });
    
    const savedResults = processorRef.current.reset();
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
    if (!processorRef.current) return;
    
    console.log("useVitalSignsProcessor: Reseteo completo", {
      estadoAnterior: {
        últimosResultados: lastValidResults ? {
          spo2: lastValidResults.spo2,
          presión: lastValidResults.pressure
        } : null,
        señalesProcesadas: processedSignals.current
      },
      timestamp: new Date().toISOString()
    });
    
    processorRef.current.fullReset();
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
    lastValidResults,
    arrhythmiaWindows,
    debugInfo: {
      processedSignals: processedSignals.current,
      signalLog: signalLog.current.slice(-10)
    }
  };
};

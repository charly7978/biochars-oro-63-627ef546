
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useRef, useEffect } from 'react';
import { VitalSignsResult } from '../modules/vital-signs/types/vital-signs-result';
import { useArrhythmiaVisualization } from './vital-signs/use-arrhythmia-visualization';
import { useSignalProcessing } from './vital-signs/use-signal-processing';
import { useVitalSignsLogging } from './vital-signs/use-vital-signs-logging';
import { UseVitalSignsProcessorReturn } from './vital-signs/types';
import { checkSignalQuality } from '../modules/heart-beat/signal-quality';

/**
 * Hook para procesamiento de signos vitales con algoritmos directos solamente
 * No se utilizan simulaciones ni valores de referencia
 */
export const useVitalSignsProcessor = (): UseVitalSignsProcessorReturn => {
  // Gestión de estado - solo medición directa, sin simulación
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  
  // Seguimiento de sesión
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  // Seguimiento de calidad de señal
  const weakSignalsCountRef = useRef<number>(0);
  const LOW_SIGNAL_THRESHOLD = 0.05;
  const MAX_WEAK_SIGNALS = 10;
  
  const { 
    arrhythmiaWindows, 
    addArrhythmiaWindow, 
    clearArrhythmiaWindows 
  } = useArrhythmiaVisualization();
  
  const { 
    processSignal: processVitalSignal, 
    initializeProcessor,
    reset: resetProcessor, 
    fullReset: fullResetProcessor,
    getArrhythmiaCounter,
    getDebugInfo,
    processedSignals
  } = useSignalProcessing();
  
  const { 
    logSignalData, 
    clearLog 
  } = useVitalSignsLogging();
  
  // Inicializar componentes del procesador - solo medición directa
  useEffect(() => {
    console.log("useVitalSignsProcessor: Initializing processor for DIRECT MEASUREMENT ONLY", {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    // Crear nuevas instancias para medición directa
    initializeProcessor();
    
    return () => {
      console.log("useVitalSignsProcessor: Processor cleanup", {
        sessionId: sessionId.current,
        totalArrhythmias: getArrhythmiaCounter(),
        processedSignals: processedSignals.current,
        timestamp: new Date().toISOString()
      });
    };
  }, [initializeProcessor, getArrhythmiaCounter, processedSignals]);
  
  /**
   * Procesar señal PPG directamente
   * Sin simulación ni valores de referencia
   */
  const processSignal = (value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => {
    // Verificar señal débil para detectar retiro del dedo usando función centralizada
    const { isWeakSignal, updatedWeakSignalsCount } = checkSignalQuality(
      value,
      weakSignalsCountRef.current,
      {
        lowSignalThreshold: LOW_SIGNAL_THRESHOLD,
        maxWeakSignalCount: MAX_WEAK_SIGNALS
      }
    );
    
    weakSignalsCountRef.current = updatedWeakSignalsCount;
    
    // Procesar señal directamente - sin simulación
    let result = processVitalSignal(value, rrData, isWeakSignal);
    const currentTime = Date.now();
    
    // Si se detecta arritmia en datos reales, registrar ventana de visualización
    if (result.arrhythmiaStatus.includes("ARRHYTHMIA DETECTED") && result.lastArrhythmiaData) {
      const arrhythmiaTime = result.lastArrhythmiaData.timestamp;
      
      // Ventana basada en ritmo cardíaco real
      let windowWidth = 400;
      
      // Ajustar basado en intervalos RR reales
      if (rrData && rrData.intervals.length > 0) {
        const lastIntervals = rrData.intervals.slice(-4);
        const avgInterval = lastIntervals.reduce((sum, val) => sum + val, 0) / lastIntervals.length;
        windowWidth = Math.max(300, Math.min(1000, avgInterval * 1.1));
      }
      
      addArrhythmiaWindow(arrhythmiaTime - windowWidth/2, arrhythmiaTime + windowWidth/2);
    }
    
    // Registrar señales procesadas
    logSignalData(value, result, processedSignals.current);
    
    // Siempre devolver resultado real
    return result;
  };

  /**
   * Realizar reinicio completo - comenzar desde cero
   * Sin simulaciones ni valores de referencia
   */
  const reset = () => {
    resetProcessor();
    clearArrhythmiaWindows();
    setLastValidResults(null);
    weakSignalsCountRef.current = 0;
    
    return null;
  };
  
  /**
   * Realizar reinicio total - borrar todos los datos
   * Sin simulaciones ni valores de referencia
   */
  const fullReset = () => {
    fullResetProcessor();
    setLastValidResults(null);
    clearArrhythmiaWindows();
    weakSignalsCountRef.current = 0;
    clearLog();
  };

  return {
    processSignal,
    reset,
    fullReset,
    arrhythmiaCounter: getArrhythmiaCounter(),
    lastValidResults: null, // Siempre devolver null para garantizar que las mediciones comiencen desde cero
    arrhythmiaWindows,
    debugInfo: getDebugInfo()
  };
};

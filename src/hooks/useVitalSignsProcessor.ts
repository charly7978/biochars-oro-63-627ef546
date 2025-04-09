
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
  
  // Estabilidad de mediciones
  const resultsHistoryRef = useRef<VitalSignsResult[]>([]);
  const lastStableResultRef = useRef<VitalSignsResult | null>(null);
  const stabilityCounterRef = useRef<number>(0);
  const MIN_STABILITY_COUNT = 3;
  
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
   * Verificar si un resultado es válido fisiológicamente
   */
  const isValidResult = (result: VitalSignsResult | null): boolean => {
    if (!result) return false;
    
    // Verificar valores fisiológicos
    const hasValidSpO2 = result.spo2 >= 80 && result.spo2 <= 100;
    const hasValidPressure = result.pressure !== "--/--";
    const hasValidGlucose = result.glucose >= 70 && result.glucose <= 180;
    const hasValidLipids = result.lipids?.totalCholesterol >= 100 && 
                          result.lipids?.totalCholesterol <= 300 &&
                          result.lipids?.triglycerides >= 50 &&
                          result.lipids?.triglycerides <= 250;
    
    return hasValidSpO2 || hasValidPressure || hasValidGlucose || hasValidLipids;
  };
  
  /**
   * Mantener estabilidad en mediciones
   */
  const stabilizeResults = (result: VitalSignsResult): VitalSignsResult => {
    // Agregar resultado a historial
    resultsHistoryRef.current.push(result);
    
    // Limitar tamaño del historial
    if (resultsHistoryRef.current.length > 10) {
      resultsHistoryRef.current.shift();
    }
    
    // Verificar si el resultado actual es válido
    const isCurrentResultValid = isValidResult(result);
    
    // Si el resultado actual es válido, usarlo y aumentar contador de estabilidad
    if (isCurrentResultValid) {
      lastStableResultRef.current = result;
      stabilityCounterRef.current = Math.min(stabilityCounterRef.current + 1, MIN_STABILITY_COUNT + 5);
      return result;
    }
    
    // Si tenemos un resultado estable anterior y suficiente estabilidad, usarlo
    if (lastStableResultRef.current && stabilityCounterRef.current >= MIN_STABILITY_COUNT) {
      // Reducir contador gradualmente para eventual transición
      stabilityCounterRef.current = Math.max(0, stabilityCounterRef.current - 0.5);
      return lastStableResultRef.current;
    }
    
    // Buscar el resultado válido más reciente en el historial
    for (let i = resultsHistoryRef.current.length - 1; i >= 0; i--) {
      const historicalResult = resultsHistoryRef.current[i];
      if (isValidResult(historicalResult)) {
        lastStableResultRef.current = historicalResult;
        return historicalResult;
      }
    }
    
    // Si no hay resultados válidos, devolver el original
    return result;
  };
  
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
    
    // Estabilizar resultados para prevenir aparición/desaparición
    result = stabilizeResults(result);
    
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
    
    // Actualizar último resultado válido
    if (isValidResult(result)) {
      setLastValidResults(result);
    }
    
    // Siempre devolver resultado estabilizado
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
    resultsHistoryRef.current = [];
    lastStableResultRef.current = null;
    stabilityCounterRef.current = 0;
    
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
    resultsHistoryRef.current = [];
    lastStableResultRef.current = null;
    stabilityCounterRef.current = 0;
    clearLog();
  };

  return {
    processSignal,
    reset,
    fullReset,
    arrhythmiaCounter: getArrhythmiaCounter(),
    lastValidResults, 
    arrhythmiaWindows,
    debugInfo: {
      processedSignals: getDebugInfo().processedSignals,
      signalLog: getDebugInfo().signalLog,
      stabilityCounter: stabilityCounterRef.current,
      resultsHistoryLength: resultsHistoryRef.current.length
    }
  };
};

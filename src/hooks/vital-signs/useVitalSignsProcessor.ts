
/**
 * Hook optimizado para procesar signos vitales
 * - Mejor estructura de código
 * - Rendimiento mejorado
 * - Mejor manejo de errores y detección
 */
import { useState, useRef, useEffect } from 'react';
import { VitalSignsResult } from '@/modules/vital-signs/types/vital-signs-result';
import { useArrhythmiaVisualization } from './use-arrhythmia-visualization';
import { useSignalProcessing } from './use-signal-processing';
import { useVitalSignsLogging } from './use-vital-signs-logging';
import { UseVitalSignsProcessorReturn } from './types';
import { checkSignalQuality } from '@/modules/heart-beat/signal-quality';

export const useVitalSignsProcessor = (): UseVitalSignsProcessorReturn => {
  // Estado centralizado
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  
  // Seguimiento de sesión para métricas
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const processStartTime = useRef<number>(Date.now());
  
  // Seguimiento de calidad de señal mejorado
  const weakSignalsCountRef = useRef<number>(0);
  const LOW_SIGNAL_THRESHOLD = 0.05;
  const MAX_WEAK_SIGNALS = 10;
  
  // Hooks especializados para diferentes aspectos del procesamiento
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
  
  // Métricas de procesamiento
  const qualityHistory = useRef<number[]>([]);
  const performanceHistory = useRef<{timestamp: number, duration: number}[]>([]);
  
  // Inicializar procesadores - solo medición directa
  useEffect(() => {
    console.log("useVitalSignsProcessor: Inicializando procesador optimizado", {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    // Crear nuevas instancias para medición directa
    initializeProcessor();
    processStartTime.current = Date.now();
    
    return () => {
      const sessionDuration = Date.now() - processStartTime.current;
      const avgProcessingTime = performanceHistory.current.length > 0
        ? performanceHistory.current.reduce((sum, item) => sum + item.duration, 0) / performanceHistory.current.length
        : 0;
      
      console.log("useVitalSignsProcessor: Limpieza del procesador", {
        sessionId: sessionId.current,
        totalArrhythmias: getArrhythmiaCounter(),
        processedSignals: processedSignals.current,
        sessionDuration: `${(sessionDuration / 1000).toFixed(2)}s`,
        avgProcessingTime: `${avgProcessingTime.toFixed(2)}ms`,
        timestamp: new Date().toISOString()
      });
    };
  }, [initializeProcessor, getArrhythmiaCounter, processedSignals]);
  
  /**
   * Procesar señal PPG directamente con medición de rendimiento
   */
  const processSignal = (value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => {
    const processingStart = performance.now();
    
    // Verificar señal débil para detectar remoción de dedo usando función centralizada
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
      
      // Ventana basada en frecuencia cardíaca real
      let windowWidth = 400;
      
      // Ajustar según intervalos RR reales
      if (rrData && rrData.intervals.length > 0) {
        const lastIntervals = rrData.intervals.slice(-4);
        const avgInterval = lastIntervals.reduce((sum, val) => sum + val, 0) / lastIntervals.length;
        windowWidth = Math.max(300, Math.min(1000, avgInterval * 1.1));
      }
      
      addArrhythmiaWindow(arrhythmiaTime - windowWidth/2, arrhythmiaTime + windowWidth/2);
    }
    
    // Registrar datos de señal procesada
    logSignalData(value, result, processedSignals.current);
    
    // Medir rendimiento y registrarlo
    const processingEnd = performance.now();
    const processingDuration = processingEnd - processingStart;
    
    performanceHistory.current.push({
      timestamp: currentTime,
      duration: processingDuration
    });
    
    if (performanceHistory.current.length > 100) {
      performanceHistory.current.shift();
    }
    
    // Registrar calidad de señal para análisis
    qualityHistory.current.push(isWeakSignal ? 0 : 1);
    if (qualityHistory.current.length > 30) {
      qualityHistory.current.shift();
    }
    
    // Registrar métricas periódicamente
    if (processedSignals.current % 100 === 0) {
      const avgQuality = qualityHistory.current.reduce((sum, val) => sum + val, 0) / qualityHistory.current.length;
      const avgProcessingTime = performanceHistory.current.reduce((sum, item) => sum + item.duration, 0) / performanceHistory.current.length;
      
      console.log("Métricas de procesamiento:", {
        signals: processedSignals.current,
        avgQuality: `${(avgQuality * 100).toFixed(1)}%`,
        avgProcessingTime: `${avgProcessingTime.toFixed(2)}ms`,
        arrhythmias: getArrhythmiaCounter()
      });
    }
    
    // Siempre retornar resultado real
    return result;
  };

  /**
   * Realizar reset completo - comenzar desde cero
   */
  const reset = () => {
    resetProcessor();
    clearArrhythmiaWindows();
    setLastValidResults(null);
    weakSignalsCountRef.current = 0;
    qualityHistory.current = [];
    performanceHistory.current = [];
    
    return null;
  };
  
  /**
   * Realizar reset completo - limpiar todos los datos
   */
  const fullReset = () => {
    fullResetProcessor();
    setLastValidResults(null);
    clearArrhythmiaWindows();
    weakSignalsCountRef.current = 0;
    clearLog();
    qualityHistory.current = [];
    performanceHistory.current = [];
  };

  return {
    processSignal,
    reset,
    fullReset,
    arrhythmiaCounter: getArrhythmiaCounter(),
    lastValidResults: null, // Siempre devolver null para asegurar que las mediciones comiencen desde cero
    arrhythmiaWindows,
    debugInfo: {
      ...getDebugInfo(),
      performance: {
        avgProcessingTime: performanceHistory.current.length > 0
          ? performanceHistory.current.reduce((sum, item) => sum + item.duration, 0) / performanceHistory.current.length
          : 0,
        signalQuality: qualityHistory.current.length > 0
          ? qualityHistory.current.reduce((sum, val) => sum + val, 0) / qualityHistory.current.length
          : 0
      }
    }
  };
};

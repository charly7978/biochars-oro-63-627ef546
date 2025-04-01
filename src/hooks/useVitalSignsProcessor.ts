/**
 * Hook for processing vital signs signals
 * Now with diagnostics channel and prioritization system
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { VitalSignsProcessor, VitalSignsResult } from '../modules/vital-signs'; // Import from central module
import { ProcessingPriority } from '../modules/extraction'; // Import priority enum
import type { RRIntervalData } from '../types/vital-signs';
import type { ArrhythmiaWindow } from './vital-signs/types';
import { getDiagnosticsData, clearDiagnosticsData } from '../hooks/heart-beat/signal-processing/peak-detection';

// Interfaz para datos de diagnóstico integral
interface DiagnosticsInfo {
  processedSignals: number;
  signalLog: Array<{ timestamp: number, value: number, result: any, priority: ProcessingPriority }>;
  performanceMetrics: {
    avgProcessTime: number;
    highPriorityPercentage: number;
    mediumPriorityPercentage: number;
    lowPriorityPercentage: number;
  };
}

export function useVitalSignsProcessor() {
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  const [arrhythmiaWindows, setArrhythmiaWindows] = useState<ArrhythmiaWindow[]>([]);
  const [diagnosticsEnabled, setDiagnosticsEnabled] = useState<boolean>(true);
  
  // Estado para diagnóstico mejorado
  const debugInfo = useRef<DiagnosticsInfo>({
    processedSignals: 0,
    signalLog: [],
    performanceMetrics: {
      avgProcessTime: 0,
      highPriorityPercentage: 0,
      mediumPriorityPercentage: 0,
      lowPriorityPercentage: 0
    }
  });
  
  // Initialize processor on mount
  const initializeProcessor = useCallback(() => {
    processorRef.current = new VitalSignsProcessor();
    console.log("VitalSignsProcessor initialized with diagnostics channel");
  }, []);

  // Initialization effect
  useEffect(() => {
    if (!processorRef.current) {
      initializeProcessor();
    }
    
    // Cleanup on unmount
    return () => {
      if (processorRef.current) {
        console.log("VitalSignsProcessor cleanup");
        processorRef.current = null;
        clearDiagnosticsData(); // Limpiar datos de diagnóstico
      }
    };
  }, [initializeProcessor]);
  
  // Actualizar métricas de rendimiento periódicamente
  useEffect(() => {
    if (!diagnosticsEnabled) return;
    
    const updateInterval = setInterval(() => {
      // Obtener datos de diagnóstico del módulo de detección de picos
      const peakDiagnostics = getDiagnosticsData();
      
      if (peakDiagnostics.length > 0) {
        // Calcular métricas de rendimiento
        const totalTime = peakDiagnostics.reduce((sum, data) => sum + data.processTime, 0);
        const highPriorityCount = peakDiagnostics.filter(data => data.processingPriority === 'high').length;
        const mediumPriorityCount = peakDiagnostics.filter(data => data.processingPriority === 'medium').length;
        const lowPriorityCount = peakDiagnostics.filter(data => data.processingPriority === 'low').length;
        
        // Actualizar métricas en debugInfo
        debugInfo.current.performanceMetrics = {
          avgProcessTime: totalTime / peakDiagnostics.length,
          highPriorityPercentage: (highPriorityCount / peakDiagnostics.length) * 100,
          mediumPriorityPercentage: (mediumPriorityCount / peakDiagnostics.length) * 100,
          lowPriorityPercentage: (lowPriorityCount / peakDiagnostics.length) * 100
        };
      }
    }, 5000); // Actualizar cada 5 segundos
    
    return () => clearInterval(updateInterval);
  }, [diagnosticsEnabled]);
  
  // Process signal data with prioritization
  const processSignal = useCallback((
    value: number, 
    rrData?: RRIntervalData
  ): VitalSignsResult => {
    if (!processorRef.current) {
      console.warn("VitalSignsProcessor not initialized");
      return {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "--",
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        },
        lastArrhythmiaData: null
      };
    }
    
    // Incrementar contador de señales procesadas
    debugInfo.current.processedSignals++;
    
    // Determinar prioridad de la señal basada en su amplitud
    let priority: ProcessingPriority;
    const signalStrength = Math.abs(value);
    
    if (signalStrength >= 0.05) {
      priority = 'high' as ProcessingPriority;
    } else if (signalStrength >= 0.02) {
      priority = 'medium' as ProcessingPriority;
    } else {
      priority = 'low' as ProcessingPriority;
    }
    
    // Medir tiempo de procesamiento para diagnóstico
    const startTime = performance.now();
    
    // Procesar señal
    const result = processorRef.current.processSignal(value, rrData);
    
    // Calcular tiempo de procesamiento
    const processingTime = performance.now() - startTime;
    
    // Log for debugging with priority info
    if (diagnosticsEnabled && debugInfo.current.processedSignals % 30 === 0) {
      debugInfo.current.signalLog.push({
        timestamp: Date.now(),
        value,
        result: { ...result },
        priority
      });
      
      // Keep log size manageable
      if (debugInfo.current.signalLog.length > 20) {
        debugInfo.current.signalLog.shift();
      }
      
      // Log para diagnóstico detallado
      console.log(`Signal processed [Priority: ${priority}] in ${processingTime.toFixed(2)}ms`, {
        signalStrength,
        arrhythmiaCount: processorRef.current.getArrhythmiaCounter(),
        spo2: result.spo2,
        pressure: result.pressure
      });
    }
    
    // Store valid results
    if (result.spo2 > 0) {
      setLastValidResults(result);
    }
    
    // Check for arrhythmia and update windows
    if (result.arrhythmiaStatus.includes("ARRHYTHMIA DETECTED")) {
      const now = Date.now();
      setArrhythmiaWindows(prev => {
        const newWindow = { start: now, end: now + 5000 };
        return [...prev, newWindow];
      });
    }
    
    return result;
  }, [diagnosticsEnabled]);
  
  // Reset the processor and return last valid results
  const reset = useCallback((): VitalSignsResult | null => {
    if (processorRef.current) {
      processorRef.current.reset();
    }
    return lastValidResults;
  }, [lastValidResults]);
  
  // Completely reset the processor
  const fullReset = useCallback((): void => {
    if (processorRef.current) {
      console.log("Full reset of VitalSignsProcessor");
      processorRef.current.fullReset();
      setLastValidResults(null);
      setArrhythmiaWindows([]);
      debugInfo.current = {
        processedSignals: 0,
        signalLog: [],
        performanceMetrics: {
          avgProcessTime: 0,
          highPriorityPercentage: 0,
          mediumPriorityPercentage: 0,
          lowPriorityPercentage: 0
        }
      };
      clearDiagnosticsData(); // Limpiar datos de diagnóstico
    }
  }, []);
  
  // Toggle diagnostics channel
  const toggleDiagnostics = useCallback((enabled: boolean): void => {
    setDiagnosticsEnabled(enabled);
    if (!enabled) {
      // Limpiar datos de diagnóstico si se desactiva
      clearDiagnosticsData();
    }
    console.log(`Diagnostics channel ${enabled ? 'enabled' : 'disabled'}`);
  }, []);
  
  // Get diagnostics data from peak detection module
  const getPeakDetectionDiagnostics = useCallback(() => {
    return getDiagnosticsData();
  }, []);
  
  return {
    processSignal,
    reset,
    fullReset,
    initializeProcessor,
    lastValidResults,
    arrhythmiaCounter: processorRef.current?.getArrhythmiaCounter() || 0,
    arrhythmiaWindows,
    debugInfo: debugInfo.current,
    diagnosticsEnabled,
    toggleDiagnostics,
    getPeakDetectionDiagnostics
  };
}

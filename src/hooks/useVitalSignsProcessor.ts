/**
 * Hook for processing vital signs signals
 * Modified to use the new refactored blood pressure processing
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { VitalSignsProcessor } from '../modules/vital-signs'; 
import { ProcessingPriority } from '../modules/extraction';
import type { VitalSignsResult, RRIntervalData } from '../types/vital-signs';
import type { ArrhythmiaWindow } from './vital-signs/types';
import { getDiagnosticsData, clearDiagnosticsData } from '../hooks/heart-beat/signal-processing/peak-detection';
import { useBloodPressureMonitor } from './useBloodPressureMonitor';

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
  
  // Use the blood pressure monitor hook
  const bloodPressureMonitor = useBloodPressureMonitor({ useAI: true });
  
  // Debug info
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
    bloodPressureMonitor.startMonitoring();
    console.log("VitalSignsProcessor initialized with blood pressure monitor");
  }, [bloodPressureMonitor]);

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
        bloodPressureMonitor.stopMonitoring();
        clearDiagnosticsData();
      }
    };
  }, [initializeProcessor, bloodPressureMonitor]);
  
  // Process signal data with blood pressure prioritization
  const processSignal = useCallback(async (
    value: number, 
    rrData?: RRIntervalData
  ): Promise<VitalSignsResult> => {
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
        }
      };
    }
    
    // Incrementar contador de señales procesadas
    debugInfo.current.processedSignals++;
    
    // Process blood pressure
    const pressure = await bloodPressureMonitor.processPPG(value);
    
    // Procesar señal for other vital signs
    const startTime = performance.now();
    const baseResult = processorRef.current.processSignal({
      value,
      rrData
    });
    
    // Replace the blood pressure result with our specialized processor result
    const result: VitalSignsResult = {
      ...baseResult,
      pressure
    };
    
    // Calcular tiempo de procesamiento
    const processingTime = performance.now() - startTime;
    
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
  }, [bloodPressureMonitor]);
  
  // Reset the processor and return last valid results
  const reset = useCallback((): VitalSignsResult | null => {
    if (processorRef.current) {
      processorRef.current.reset();
    }
    bloodPressureMonitor.reset();
    return lastValidResults;
  }, [lastValidResults, bloodPressureMonitor]);
  
  // Completely reset the processor
  const fullReset = useCallback((): void => {
    if (processorRef.current) {
      console.log("Full reset of VitalSignsProcessor");
      processorRef.current.fullReset();
      bloodPressureMonitor.reset();
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
      clearDiagnosticsData();
    }
  }, [bloodPressureMonitor]);
  
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

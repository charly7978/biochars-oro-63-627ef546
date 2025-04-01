
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useRef, useCallback } from 'react';
import { VitalSignsProcessor, VitalSignsResult } from '../modules/VitalSignsProcessor';

// Interface for the hook return type
interface UseVitalSignsProcessorReturn {
  processSignal: (value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => VitalSignsResult;
  reset: () => VitalSignsResult | null;
  fullReset: () => void;
  arrhythmiaCounter: number;
  lastValidResults: VitalSignsResult | null;
  arrhythmiaWindows: Array<{start: number, end: number}>;
  debugInfo: any;
}

/**
 * Hook for processing vital signs with direct algorithms only
 * No simulation or reference values are used
 */
export const useVitalSignsProcessor = (): UseVitalSignsProcessorReturn => {
  // State management - only direct measurement, no simulation
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  
  // Create processor instance
  const processorRef = useRef<VitalSignsProcessor>(new VitalSignsProcessor());
  
  // Session tracking
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  // Signal quality tracking
  const weakSignalsCountRef = useRef<number>(0);
  const processedSignals = useRef<number>(0);
  
  // Mock for arrhythmia visualization until we implement it properly
  const arrhythmiaWindows = useRef<Array<{start: number, end: number}>>([]);
  
  /**
   * Process PPG signal directly
   * No simulation or reference values
   */
  const processSignal = useCallback((value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => {
    // Process signal directly - no simulation
    const result = processorRef.current.processSignal(value, rrData);
    processedSignals.current++;
    
    return result;
  }, []);

  /**
   * Reset the processor but keep calibration
   */
  const reset = useCallback(() => {
    console.log("useVitalSignsProcessor: Resetting processor");
    const savedResults = processorRef.current.reset();
    setLastValidResults(savedResults);
    return savedResults;
  }, []);
  
  /**
   * Perform full reset - clear all data
   * No simulations or reference values
   */
  const fullReset = useCallback(() => {
    console.log("useVitalSignsProcessor: Full reset");
    processorRef.current.fullReset();
    setLastValidResults(null);
    arrhythmiaWindows.current = [];
    weakSignalsCountRef.current = 0;
  }, []);

  /**
   * Add arrhythmia visualization window
   */
  const addArrhythmiaWindow = useCallback((start: number, end: number) => {
    arrhythmiaWindows.current.push({ start, end });
  }, []);

  /**
   * Clear all arrhythmia windows
   */
  const clearArrhythmiaWindows = useCallback(() => {
    arrhythmiaWindows.current = [];
  }, []);

  return {
    processSignal,
    reset,
    fullReset,
    arrhythmiaCounter: processorRef.current.getArrhythmiaCounter(),
    lastValidResults,
    arrhythmiaWindows: arrhythmiaWindows.current,
    debugInfo: {}
  };
};

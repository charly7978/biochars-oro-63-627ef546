
/**
 * Functions for signal processing logic, working with real data only
 */

import { useRef, useCallback } from 'react';
import { VitalSignsResult } from '../../modules/vital-signs/types/vital-signs-result';
import { VitalSignsProcessor } from '../../modules/vital-signs/VitalSignsProcessor';
import { ResultFactory } from '../../modules/vital-signs/factories/result-factory';

/**
 * Hook for processing signal using the VitalSignsProcessor
 * Direct measurement only, no simulation
 */
export const useSignalProcessing = () => {
  // Reference for processor instance
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const processedSignals = useRef<number>(0);
  const signalLog = useRef<{timestamp: number, value: number, result: any}[]>([]);
  
  /**
   * Process PPG signal directly
   * No simulation or reference values
   */
  const processSignal = useCallback((
    value: number, 
    rrData?: { intervals: number[], lastPeakTime: number | null },
    isWeakSignal: boolean = false
  ): VitalSignsResult => {
    if (!processorRef.current) {
      console.log("useVitalSignsProcessor: Processor not initialized");
      processorRef.current = new VitalSignsProcessor(); // Auto-initialize if needed
      console.log("useVitalSignsProcessor: Auto-initialized processor");
    }
    
    processedSignals.current++;
    
    // If too many weak signals, return zeros
    if (isWeakSignal) {
      console.log("useVitalSignsProcessor: Weak signal detected, skipping processing");
      return ResultFactory.createEmptyResults();
    }
    
    // Logging for diagnostics
    if (processedSignals.current % 15 === 0) {
      console.log("useVitalSignsProcessor: Processing signal DIRECTLY", {
        inputValue: value,
        rrDataPresent: !!rrData,
        rrIntervals: rrData?.intervals.length || 0,
        arrhythmiaCount: processorRef.current.getArrhythmiaCounter(),
        signalNumber: processedSignals.current
      });
    }
    
    try {
      // Process signal directly - no simulation
      let result = processorRef.current.processSignal(value, rrData);
      
      // Log processed signals for debugging
      signalLog.current.push({
        timestamp: Date.now(),
        value,
        result: JSON.stringify(result)
      });
      
      if (signalLog.current.length > 100) {
        signalLog.current = signalLog.current.slice(-100);
      }
      
      console.log("useVitalSignsProcessor: Processed result", {
        heartRate: result.heartRate,
        spo2: result.spo2,
        pressure: result.pressure,
        arrhythmiaStatus: result.arrhythmiaStatus,
        processedSignals: processedSignals.current
      });
      
      // Always return real result
      return result;
    } catch (error) {
      console.error("Error processing vital signs:", error);
      
      // Return safe fallback values on error
      return ResultFactory.createEmptyResults();
    }
  }, []);

  /**
   * Initialize the processor
   * Direct measurement only
   */
  const initializeProcessor = useCallback(() => {
    console.log("useVitalSignsProcessor: Initializing processor for DIRECT MEASUREMENT ONLY");
    
    // Create new instances for direct measurement
    processorRef.current = new VitalSignsProcessor();
    
    console.log("useVitalSignsProcessor: Processor initialized successfully");
    
    return processorRef.current;
  }, []);

  /**
   * Reset the processor
   * No simulations or reference values
   */
  const reset = useCallback(() => {
    if (!processorRef.current) return null;
    
    console.log("useVitalSignsProcessor: Reset initiated - DIRECT MEASUREMENT mode only");
    
    processorRef.current.reset();
    
    console.log("useVitalSignsProcessor: Reset completed - all values at zero for direct measurement");
    return null;
  }, []);
  
  /**
   * Perform full reset - clear all data
   * No simulations or reference values
   */
  const fullReset = useCallback(() => {
    if (!processorRef.current) {
      processorRef.current = new VitalSignsProcessor();
    }
    
    console.log("useVitalSignsProcessor: Full reset initiated - DIRECT MEASUREMENT mode only");
    
    processorRef.current.fullReset();
    processedSignals.current = 0;
    signalLog.current = [];
    
    console.log("useVitalSignsProcessor: Full reset complete - direct measurement mode active");
  }, []);

  /**
   * Get the arrhythmia counter
   */
  const getArrhythmiaCounter = useCallback(() => {
    if (!processorRef.current) {
      return 0;
    }
    return processorRef.current.getArrhythmiaCounter() || 0;
  }, []);

  /**
   * Get debug information about signal processing
   */
  const getDebugInfo = useCallback(() => {
    return {
      processorInitialized: !!processorRef.current,
      processedSignals: processedSignals.current,
      signalLog: signalLog.current.slice(-10)
    };
  }, []);

  return {
    processSignal,
    initializeProcessor,
    reset,
    fullReset,
    getArrhythmiaCounter,
    getDebugInfo,
    processorRef,
    processedSignals,
    signalLog
  };
};

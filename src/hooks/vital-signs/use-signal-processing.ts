
/**
 * Functions for signal processing logic, working with real data only
 * Fase 3: Implementar paso directo sin manipulaciones
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
      return ResultFactory.createEmptyResults();
    }
    
    processedSignals.current++;
    
    // If too many weak signals, return zeros
    if (isWeakSignal) {
      return ResultFactory.createEmptyResults();
    }
    
    // Logging for diagnostics
    if (processedSignals.current % 45 === 0) {
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
      // Important: We've changed this to handle sync processing only, avoiding Promise issues
      let result = processorRef.current.processSignal(value, rrData);
      
      // Add null checks for arrhythmia status
      if (result && 
          result.arrhythmiaStatus && 
          typeof result.arrhythmiaStatus === 'string' && 
          result.arrhythmiaStatus.includes("ARRHYTHMIA DETECTED") && 
          result.lastArrhythmiaData) {
        const arrhythmiaTime = result.lastArrhythmiaData.timestamp;
        
        // Window based on real heart rate - sin Math.max/min
        let windowWidth = 400;
        
        // Adjust based on real RR intervals
        if (rrData && rrData.intervals && rrData.intervals.length > 0) {
          const lastIntervals = rrData.intervals.slice(-4);
          let sum = 0;
          for (let i = 0; i < lastIntervals.length; i++) {
            sum += lastIntervals[i];
          }
          const avgInterval = sum / lastIntervals.length;
          
          // Usar condicionales directos en lugar de Math.max/min
          windowWidth = avgInterval * 1.1;
          if (windowWidth < 300) windowWidth = 300;
          if (windowWidth > 1000) windowWidth = 1000;
        }
      }
      
      // Log processed signals
      signalLog.current.push({
        timestamp: Date.now(),
        value,
        result
      });
      
      if (signalLog.current.length > 100) {
        signalLog.current = signalLog.current.slice(-100);
      }
      
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
    console.log("useVitalSignsProcessor: Initializing processor for DIRECT MEASUREMENT ONLY", {
      timestamp: new Date().toISOString()
    });
    
    // Create new instances for direct measurement
    processorRef.current = new VitalSignsProcessor();
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
    if (!processorRef.current) return;
    
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
    return processorRef.current?.getArrhythmiaCounter() || 0;
  }, []);

  /**
   * Get debug information about signal processing
   */
  const getDebugInfo = useCallback(() => {
    return {
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

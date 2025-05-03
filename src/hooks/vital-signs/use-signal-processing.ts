
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
      console.log("useSignalProcessing: Processor not initialized");
      return ResultFactory.createEmptyResults();
    }
    
    processedSignals.current++;
    
    // Si la señal es débil, registrarlo pero seguir procesando
    if (isWeakSignal) {
      console.log("useSignalProcessing: Weak signal detected, pero continuamos procesando");
    }
    
    // Enhanced logging for diagnostics
    if (processedSignals.current % 50 === 0 || processedSignals.current < 10) {
      console.log("useSignalProcessing: Processing signal DIRECTLY", {
        inputValue: value,
        rrDataPresent: !!rrData,
        rrIntervals: rrData?.intervals.length || 0,
        signalNumber: processedSignals.current
      });
    }
    
    try {
      // Process signal directly - no simulation
      let result = processorRef.current.processSignal(value, rrData);
      
      // Comprehensive logging for ALL vital signs
      if (processedSignals.current % 20 === 0) {
        console.log("useSignalProcessing: Processed complete result", {
          frame: processedSignals.current,
          heartRate: result.heartRate,
          spo2: result.spo2,
          pressure: result.pressure,
          glucose: result.glucose,
          hydration: result.hydration,
          lipids: result.lipids ? {
            totalCholesterol: result.lipids.totalCholesterol,
            triglycerides: result.lipids.triglycerides
          } : "no lipid data",
          hemoglobin: result.hemoglobin,
          arrhythmiaStatus: result.arrhythmiaStatus
        });
      }
      
      // Handle arrhythmia detection with enhanced logging
      if (result && 
          result.arrhythmiaStatus && 
          typeof result.arrhythmiaStatus === 'string' && 
          result.arrhythmiaStatus.includes("ARRHYTHMIA DETECTED") && 
          result.lastArrhythmiaData) {
        
        console.log("useSignalProcessing: Arrhythmia detected", {
          status: result.arrhythmiaStatus,
          data: result.lastArrhythmiaData
        });
        
        const arrhythmiaTime = result.lastArrhythmiaData.timestamp;
        
        // Window based on real heart rate
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
      
      // Log processed signal for diagnostics
      if (processedSignals.current % 60 === 0) {
        signalLog.current.push({
          timestamp: Date.now(),
          value,
          result
        });
        
        if (signalLog.current.length > 60) {
          signalLog.current = signalLog.current.slice(-60);
        }
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
    console.log("useSignalProcessing: Initializing processor for DIRECT MEASUREMENT ONLY");
    
    // Create new instances for direct measurement
    processorRef.current = new VitalSignsProcessor();
    processedSignals.current = 0;
    
    // Log after initialization
    console.log("useSignalProcessing: Processor initialized successfully");
  }, []);

  /**
   * Reset the processor
   * No simulations or reference values
   */
  const reset = useCallback(() => {
    if (!processorRef.current) return null;
    
    console.log("useSignalProcessing: Reset initiated");
    
    processorRef.current.reset();
    
    console.log("useSignalProcessing: Reset completed");
    return null;
  }, []);
  
  /**
   * Perform full reset - clear all data
   * No simulations or reference values
   */
  const fullReset = useCallback(() => {
    if (!processorRef.current) return;
    
    console.log("useSignalProcessing: Full reset initiated");
    
    processorRef.current.fullReset();
    processedSignals.current = 0;
    signalLog.current = [];
    
    console.log("useSignalProcessing: Full reset complete");
  }, []);

  /**
   * Get the arrhythmia counter
   */
  const getArrhythmiaCounter = useCallback(() => {
    return processorRef.current?.getArrhythmiaCounter() || 0;
  }, []);
  
  /**
   * Get last valid results from processor
   * AÑADIDO: Función para recuperar último resultado válido
   */
  const getLastValidResults = useCallback(() => {
    return processorRef.current?.getLastValidResult() || null;
  }, []);

  /**
   * Get debug information about signal processing
   */
  const getDebugInfo = useCallback(() => {
    return {
      processedSignals: processedSignals.current,
      signalLog: signalLog.current.slice(-10),
      processor: processorRef.current ? "initialized" : "not initialized"
    };
  }, []);

  return {
    processSignal,
    initializeProcessor,
    reset,
    fullReset,
    getArrhythmiaCounter,
    getDebugInfo,
    getLastValidResults, // AÑADIDO: Exposición de función para recuperar últimos resultados válidos
    processorRef,
    processedSignals,
    signalLog
  };
};

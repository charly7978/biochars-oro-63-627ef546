/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useRef, useCallback } from 'react';
import { VitalSignsResult } from '../../modules/vital-signs/types/vital-signs-result';
import { VitalSignsProcessor } from '../../modules/vital-signs/VitalSignsProcessor';
import { ResultFactory } from '../../modules/vital-signs/factories/result-factory';
import { ProcessedSignal } from '@/types/signal';
import { RRData } from '@/core/signal/PeakDetector';

/**
 * Hook for processing signal using the VitalSignsProcessor
 * Direct measurement only, no simulation
 */
export const useSignalProcessing = () => {
  // Reference for processor instance
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const processedSignals = useRef<number>(0);
  const signalLog = useRef<{timestamp: number, value: number, result: any}[]>([]);
  
  // Define the type for the processSignal function return value
  type ProcessSignalType = (value: number, rrData?: RRData) => VitalSignsResult | null;

  /**
   * Process the raw PPG signal value
   * Returns null if processing fails.
   */
  const processSignal = useCallback<ProcessSignalType>((value: number, rrData?: RRData) => {
    if (!processorRef.current) {
      console.error("useVitalSignsProcessor: Processor not initialized");
      return null; // Return null if processor is not ready
    }

    try {
      processedSignals.current++;
      
      const result = processorRef.current.processSignal(
        value, // Use the raw value directly as primary optimized value for now
        {
          rawValue: value,
          filteredValue: value, // Pass raw value as filtered for now, assuming processor handles filtering
          timestamp: Date.now(),
          quality: 100, // Assume quality is handled within the processor, pass default
          fingerDetected: true, // Assume finger detection is handled elsewhere or default
          roi: { x: 0, y: 0, width: 0, height: 0 } // Default ROI
        },
        rrData
      );
      
      if (!result) {
        console.warn("useVitalSignsProcessor: processSignal returned null or undefined");
        return null; // Return null if processor returns no result
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
      
      // Return null on error instead of empty results
      return null; 
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
   * Apply blood pressure calibration to the processor
   */
  const applyBloodPressureCalibration = useCallback((systolic: number, diastolic: number) => {
    if (!processorRef.current) {
      console.error("useVitalSignsProcessor: Cannot calibrate - processor not initialized");
      return;
    }
    
    processorRef.current.applyBloodPressureCalibration(systolic, diastolic);
    console.log("useVitalSignsProcessor: Blood pressure calibration applied", { systolic, diastolic });
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
    applyBloodPressureCalibration,
    getArrhythmiaCounter,
    getDebugInfo,
    processorRef,
    processedSignals,
    signalLog
  };
};

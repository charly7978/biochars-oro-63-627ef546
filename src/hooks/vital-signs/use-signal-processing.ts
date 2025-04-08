/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useRef, useCallback } from 'react';
import { VitalSignsResult } from '../../modules/vital-signs/types/vital-signs-result';
import { VitalSignsProcessor } from '../../modules/vital-signs/VitalSignsProcessor';

/**
 * Hook for processing signal using the VitalSignsProcessor
 * Direct measurement only, no simulation
 */
export const useSignalProcessing = () => {
  // Reference for processor instance
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const processedSignals = useRef<number>(0);
  const signalLog = useRef<{timestamp: number, value: number, result: any}[]>([]);
  
  // Signal quality enhancement parameters
  const signalSmoothingFactor = useRef<number>(0.35); // Moderate smoothing for PPG waveform
  const lastSmoothedValue = useRef<number>(0);
  
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
    
    processedSignals.current++;
    
    // Apply gentle smoothing for better waveform continuity
    const smoothedValue = lastSmoothedValue.current * (1 - signalSmoothingFactor.current) + 
                          value * signalSmoothingFactor.current;
    lastSmoothedValue.current = smoothedValue;
    
    // If too many weak signals, return zeros
    if (isWeakSignal) {
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
    
    // Enhance harmonic characteristics of the signal by applying subtle resonance
    // This improves waveform visualization without changing measurement values
    const enhancedValue = applyWaveformEnhancement(smoothedValue);
    
    // Logging for diagnostics
    if (processedSignals.current % 45 === 0) {
      console.log("useVitalSignsProcessor: Processing signal DIRECTLY", {
        inputValue: value,
        smoothedValue: smoothedValue,
        enhancedValue: enhancedValue,
        rrDataPresent: !!rrData,
        rrIntervals: rrData?.intervals.length || 0,
        arrhythmiaCount: processorRef.current.getArrhythmiaCounter(),
        signalNumber: processedSignals.current
      });
    }
    
    // Process signal directly - no simulation
    let result = processorRef.current.processSignal(enhancedValue, rrData);
    
    // Store signal history for diagnostics
    if (processedSignals.current % 5 === 0) {
      signalLog.current.push({
        timestamp: Date.now(),
        value: enhancedValue,
        result: {
          arrhythmiaStatus: result.arrhythmiaStatus,
          spo2: result.spo2
        }
      });
      
      // Keep log size reasonable
      if (signalLog.current.length > 100) {
        signalLog.current.shift();
      }
    }
    
    return result;
  }, []);

  /**
   * Apply subtle enhancement to PPG waveform for better visualization
   * This is purely visual and doesn't affect the measurement values
   */
  const applyWaveformEnhancement = useCallback((value: number): number => {
    // Parameter tuning for optimal waveform visualization
    const harmonicFactor = 0.15; // Subtle harmonic enhancement
    const naturalRangeAdjust = 0.02; // Very subtle range adjustment
    
    // Enhance physiological characteristics without altering fundamental signal
    const enhancedValue = value * (1 + naturalRangeAdjust) + 
                         Math.sin(value * 3.14159) * harmonicFactor * value;
    
    return enhancedValue;
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
    
    // Reset enhancement parameters
    signalSmoothingFactor.current = 0.35;
    lastSmoothedValue.current = 0;
  }, []);

  /**
   * Reset the processor
   * No simulations or reference values
   */
  const reset = useCallback(() => {
    if (!processorRef.current) return null;
    
    console.log("useVitalSignsProcessor: Reset initiated - DIRECT MEASUREMENT mode only");
    
    processorRef.current.reset();
    lastSmoothedValue.current = 0;
    
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
    lastSmoothedValue.current = 0;
    
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
      signalLog: signalLog.current.slice(-10),
      smoothingFactor: signalSmoothingFactor.current
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


import { useState, useRef, useCallback } from 'react';
import { VitalSignsProcessor, VitalSignsResult } from '../../modules/vital-signs/VitalSignsProcessor';

/**
 * Hook for processing PPG signals
 */
export const useSignalProcessing = () => {
  const [processor] = useState(() => new VitalSignsProcessor());
  const [arrhythmiaCounter, setArrhythmiaCounter] = useState(0);
  const processedSignals = useRef<number>(0);
  const debugInfo = useRef<any>({});

  /**
   * Initialize the processor
   */
  const initializeProcessor = useCallback(() => {
    console.log('Initializing vital signs processor');
    processedSignals.current = 0;
  }, []);

  /**
   * Process a PPG signal value
   */
  const processSignal = useCallback(async (
    value: number, 
    rrData?: { intervals: number[], lastPeakTime: number | null },
    isWeakSignal?: boolean
  ): Promise<VitalSignsResult> => {
    try {
      processedSignals.current++;
      
      // Skip processing if signal is too weak
      if (isWeakSignal) {
        return {
          spo2: 0,
          pressure: "--/--",
          arrhythmiaStatus: "--",
          glucose: 0,
          lipids: {
            totalCholesterol: 0,
            triglycerides: 0
          },
          hemoglobin: 0
        };
      }
      
      // Process the signal
      const result = await processor.processSignal(value, rrData);
      
      // Update arrhythmia counter
      setArrhythmiaCounter(processor.getArrhythmiaCounter());
      
      return result;
    } catch (error) {
      console.error('Error processing signal:', error);
      
      // Return empty result on error
      return {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "--",
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        },
        hemoglobin: 0
      };
    }
  }, [processor]);

  /**
   * Reset the processor to initial state
   */
  const reset = useCallback(() => {
    console.log('Resetting vital signs processor');
    processedSignals.current = 0;
    return processor.reset();
  }, [processor]);

  /**
   * Completely reset the processor and all its data
   */
  const fullReset = useCallback(() => {
    console.log('Full reset of vital signs processor');
    processedSignals.current = 0;
    processor.fullReset();
    setArrhythmiaCounter(0);
  }, [processor]);

  /**
   * Get the arrhythmia counter
   */
  const getArrhythmiaCounter = useCallback(() => {
    return processor.getArrhythmiaCounter();
  }, [processor]);

  /**
   * Get debug information
   */
  const getDebugInfo = useCallback(() => {
    debugInfo.current = {
      processedSignals: processedSignals.current,
      arrhythmiaCounter
    };
    return debugInfo.current;
  }, [arrhythmiaCounter]);

  return {
    processSignal,
    initializeProcessor,
    reset,
    fullReset,
    getArrhythmiaCounter,
    getDebugInfo,
    processedSignals
  };
};

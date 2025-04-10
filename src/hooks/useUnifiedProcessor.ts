
/**
 * Unified Processor Hook
 * Provides a single integration point for signal processing, vital signs, and heart rate
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useCentralSignalProcessor } from './useCentralSignalProcessor';
import { SignalProcessingResult } from './useCentralSignalProcessor';
import { toast } from 'sonner';

export interface UnifiedProcessorResult {
  // Signal state
  lastSignal: {
    value: number;
    filteredValue: number;
    quality: number;
    fingerDetected: boolean;
  } | null;
  
  // Heart rate state
  heartRate: number;
  isArrhythmia: boolean;
  
  // Vital signs
  vitalSigns: {
    spo2: number;
    pressure: string;
    arrhythmiaStatus: string;
    arrhythmiaCount: number;
    glucose: number;
    lipids: {
      totalCholesterol: number;
      triglycerides: number;
    };
    hemoglobin: number;
  };
  
  // Status
  elapsedTime: number;
  isProcessing: boolean;
  
  // Arrhythmia data for visualization
  arrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
}

export function useUnifiedProcessor() {
  const {
    processSignal,
    processFrame,
    startProcessing,
    stopProcessing: stopCentralProcessing,
    reset: resetCentralProcessor,
    lastResult,
    isProcessing,
    elapsedTime,
    arrhythmiaCount
  } = useCentralSignalProcessor();
  
  const [result, setResult] = useState<UnifiedProcessorResult>({
    lastSignal: null,
    heartRate: 0,
    isArrhythmia: false,
    vitalSigns: {
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: "--",
      arrhythmiaCount: 0,
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      },
      hemoglobin: 0
    },
    elapsedTime: 0,
    isProcessing: false
  });
  
  // Update result when lastResult changes
  useEffect(() => {
    if (lastResult) {
      setResult({
        lastSignal: {
          value: lastResult.value,
          filteredValue: lastResult.filteredValue,
          quality: lastResult.quality,
          fingerDetected: lastResult.fingerDetected
        },
        heartRate: lastResult.heartRate,
        isArrhythmia: lastResult.isArrhythmia,
        vitalSigns: {
          ...lastResult.vitalSigns,
          arrhythmiaCount
        },
        elapsedTime,
        isProcessing,
        arrhythmiaData: lastResult.arrhythmiaData
      });
    }
  }, [lastResult, elapsedTime, isProcessing, arrhythmiaCount]);
  
  // Start processing
  const startMonitoring = useCallback(() => {
    startProcessing();
    toast.success("Medición iniciada");
  }, [startProcessing]);
  
  // Stop processing
  const stopMonitoring = useCallback(() => {
    stopCentralProcessing();
    toast.info("Medición detenida");
  }, [stopCentralProcessing]);
  
  // Reset everything
  const reset = useCallback(() => {
    resetCentralProcessor();
    
    setResult({
      lastSignal: null,
      heartRate: 0,
      isArrhythmia: false,
      vitalSigns: {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "--",
        arrhythmiaCount: 0,
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        },
        hemoglobin: 0
      },
      elapsedTime: 0,
      isProcessing: false
    });
    
    toast.success("Medición reiniciada");
  }, [resetCentralProcessor]);
  
  return {
    // Results
    result,
    
    // Methods for signal processing
    processSignal,
    processFrame,
    
    // Control functions
    startMonitoring,
    stopMonitoring,
    reset,
    
    // Status
    isProcessing,
    elapsedTime
  };
}

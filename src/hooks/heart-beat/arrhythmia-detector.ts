
import { useCallback, useRef } from 'react';
import ArrhythmiaDetectionService from '@/services/ArrhythmiaDetectionService';

/**
 * Hook for arrhythmia detection in heart beat signals
 * Delegates to centralized ArrhythmiaDetectionService
 */
export function useArrhythmiaDetector() {
  // Last RR intervals storage
  const lastRRIntervalsRef = useRef<number[]>([]);
  
  /**
   * Detect arrhythmia based on RR interval variations
   * Delegates to ArrhythmiaDetectionService
   */
  const detectArrhythmia = useCallback((rrIntervals: number[]) => {
    // Update intervals in the service
    ArrhythmiaDetectionService.updateRRIntervals(rrIntervals);
    lastRRIntervalsRef.current = rrIntervals;
    
    // Delegate detection to the centralized service
    return ArrhythmiaDetectionService.detectArrhythmia(rrIntervals);
  }, []);
  
  /**
   * Reset all detectors and counters
   */
  const reset = useCallback(() => {
    lastRRIntervalsRef.current = [];
    ArrhythmiaDetectionService.reset();
  }, []);
  
  return {
    detectArrhythmia,
    lastRRIntervalsRef,
    lastIsArrhythmiaRef: { 
      get current() { return ArrhythmiaDetectionService.isArrhythmia(); }
    },
    currentBeatIsArrhythmiaRef: { 
      get current() { return ArrhythmiaDetectionService.isArrhythmia(); }
    },
    reset
  };
}

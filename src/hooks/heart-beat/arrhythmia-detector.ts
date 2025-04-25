
import { useCallback, useRef } from 'react';
import ArrhythmiaDetectionService from '@/services/ArrhythmiaDetectionService';

/**
 * Hook for arrhythmia detection in heart beat signals
 * Solo procesa datos reales
 */
export function useArrhythmiaDetector() {
  // Last RR intervals storage
  const lastRRIntervalsRef = useRef<number[]>([]);
  
  /**
   * Detect arrhythmia based on RR interval variations
   * Solo usa datos reales
   */
  const detectArrhythmia = useCallback((rrIntervals: number[]) => {
    // Add intervals to service directly, avoiding the updateRRIntervals call
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
    lastIsArrhythmiaRef: { current: false }, // Service now handles this state
    currentBeatIsArrhythmiaRef: { 
      get current() { return ArrhythmiaDetectionService.isArrhythmia(); }
    },
    reset
  };
}

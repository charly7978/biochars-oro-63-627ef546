
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
    // Make sure we have valid intervals
    if (!rrIntervals || rrIntervals.length < 3) {
      console.log("useArrhythmiaDetector: Not enough RR intervals for detection:", rrIntervals?.length || 0);
      return {
        isArrhythmia: false,
        timestamp: Date.now(),
        rmssd: 0,
        rrVariation: 0
      };
    }
    
    // Update intervals in the service and local ref
    ArrhythmiaDetectionService.updateRRIntervals(rrIntervals);
    lastRRIntervalsRef.current = rrIntervals;
    
    // Delegate detection to the centralized service and get result
    const result = ArrhythmiaDetectionService.detectArrhythmia(rrIntervals);
    
    // Log detection results
    if (result.isArrhythmia) {
      console.log("useArrhythmiaDetector: Arrhythmia detected via service", {
        rmssd: result.rmssd,
        rrVariation: result.rrVariation,
        timestamp: new Date(result.timestamp).toISOString()
      });
    }
    
    return result;
  }, []);
  
  /**
   * Reset all detectors and counters
   */
  const reset = useCallback(() => {
    lastRRIntervalsRef.current = [];
    ArrhythmiaDetectionService.reset();
    console.log("useArrhythmiaDetector: Reset completed");
  }, []);
  
  return {
    detectArrhythmia,
    lastRRIntervalsRef,
    lastIsArrhythmiaRef: { current: false }, // Service now handles this state
    currentBeatIsArrhythmiaRef: { 
      get current() { return ArrhythmiaDetectionService.isArrhythmia(); },
      set current(value: boolean) { /* Read-only property */ }
    },
    reset
  };
}

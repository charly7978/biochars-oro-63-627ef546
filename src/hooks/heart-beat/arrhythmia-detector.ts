import { useCallback, useRef } from 'react';
import ArrhythmiaDetectionService from '@/services/arrhythmia';
import { ArrhythmiaStatus } from '@/services/arrhythmia/types';

/**
 * Hook for arrhythmia detection
 * @returns Functions for detecting and managing arrhythmias
 */
export function useArrhythmiaDetector() {
  // Reference to keep track of sorted intervals
  const lastIntervalsRef = useRef<number[]>([]);
  
  /**
   * Process RR intervals for arrhythmia detection
   * @param rrIntervals Array of RR intervals in milliseconds
   * @returns Arrhythmia detection result
   */
  const processRRIntervals = useCallback((rrIntervals: number[]) => {
    if (!rrIntervals || rrIntervals.length < 3) {
      return {
        isArrhythmia: false,
        arrhythmiaType: 'normal' as ArrhythmiaStatus,
        confidence: 0
      };
    }

    // Get a copy of the intervals for analysis
    const intervals = [...rrIntervals];
    lastIntervalsRef.current = intervals;
    
    // Basic analysis for significant variation
    const avg = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    
    // Calculate variation
    const variations = intervals.map(rr => Math.abs((rr - avg) / avg));
    const maxVariation = Math.max(...variations);
    
    // Simple arrhythmia detection based on variability
    let arrhythmiaType: ArrhythmiaStatus = 'normal';
    let confidence = 0;
    let isArrhythmia = false;
    
    // Check for bradycardia (heart rate < 60 BPM)
    if (avg > 1000) {
      arrhythmiaType = 'bradycardia';
      confidence = 0.8;
      isArrhythmia = true;
      
      // Notify the service
      ArrhythmiaDetectionService.updateStatus('bradycardia', confidence, { intervals });
    } 
    // Check for tachycardia (heart rate > 100 BPM)
    else if (avg < 600) {
      arrhythmiaType = 'tachycardia';
      confidence = 0.8;
      isArrhythmia = true;
      
      // Notify the service
      ArrhythmiaDetectionService.updateStatus('tachycardia', confidence, { intervals });
    }
    // Check for high RR variability which could indicate other arrhythmias
    else if (maxVariation > 0.2) {
      arrhythmiaType = 'possible-afib';
      confidence = Math.min(maxVariation, 0.9);
      isArrhythmia = true;
      
      // Notify the service
      ArrhythmiaDetectionService.updateStatus('possible-afib', confidence, { intervals });
    } else {
      // Reset to normal if no arrhythmia detected
      ArrhythmiaDetectionService.updateStatus('normal', 0, {});
    }
    
    return {
      isArrhythmia,
      arrhythmiaType,
      confidence
    };
  }, []);
  
  /**
   * Reset the arrhythmia detection state
   */
  const resetDetection = useCallback(() => {
    lastIntervalsRef.current = [];
    ArrhythmiaDetectionService.updateStatus('normal', 0, {});
  }, []);
  
  return {
    processRRIntervals,
    resetDetection,
    lastIntervalsRef
  };
}


import { useCallback, useRef } from 'react';

/**
 * Hook for arrhythmia detection in heart beat signals
 */
export function useArrhythmiaDetector() {
  // Reference for HRV data
  const heartRateVariabilityRef = useRef<number[]>([]);
  // Stability counter to filter out transient irregularities
  const stabilityCounterRef = useRef<number>(0);
  // Last RR intervals storage
  const lastRRIntervalsRef = useRef<number[]>([]);
  // Tracking if last beat was arrhythmic
  const lastIsArrhythmiaRef = useRef<boolean>(false);
  // Tracking if current beat is arrhythmic
  const currentBeatIsArrhythmiaRef = useRef<boolean>(false);
  
  // Arrhythmia detection constants
  const DETECTION_THRESHOLD = 0.25;
  const MIN_INTERVAL = 300; // 300ms minimum (200 BPM max)
  const MAX_INTERVAL = 2000; // 2000ms maximum (30 BPM min)
  
  /**
   * Detect arrhythmia based on RR interval variations
   */
  const detectArrhythmia = useCallback((rrIntervals: number[]) => {
    if (rrIntervals.length < 5) {
      return {
        isArrhythmia: false,
        rmssd: 0,
        rrVariation: 0,
        timestamp: Date.now()
      };
    }
    
    // Get the 5 most recent intervals for analysis
    const lastIntervals = rrIntervals.slice(-5);
    
    // Calculate RMSSD (Root Mean Square of Successive Differences)
    let sumOfSquares = 0;
    for (let i = 1; i < lastIntervals.length; i++) {
      const diff = lastIntervals[i] - lastIntervals[i-1];
      sumOfSquares += diff * diff;
    }
    const rmssd = Math.sqrt(sumOfSquares / (lastIntervals.length - 1));
    
    // Calculate variation ratio (normalized variability)
    const mean = lastIntervals.reduce((sum, val) => sum + val, 0) / lastIntervals.length;
    const variationRatio = rmssd / mean;
    
    // Adjust threshold based on stability
    let thresholdFactor = DETECTION_THRESHOLD;
    if (stabilityCounterRef.current > 15) {
      thresholdFactor = 0.20; // Lower threshold when stable
    } else if (stabilityCounterRef.current < 5) {
      thresholdFactor = 0.30; // Higher threshold when unstable
    }
    
    // Determine if rhythm is irregular
    const isIrregular = variationRatio > thresholdFactor;
    
    // Update stability counter
    if (!isIrregular) {
      stabilityCounterRef.current = Math.min(30, stabilityCounterRef.current + 1);
    } else {
      stabilityCounterRef.current = Math.max(0, stabilityCounterRef.current - 2);
    }
    
    // Require more stability for confirmed arrhythmia
    const isArrhythmia = isIrregular && stabilityCounterRef.current > 10;
    
    // Update HRV data
    heartRateVariabilityRef.current.push(variationRatio);
    if (heartRateVariabilityRef.current.length > 20) {
      heartRateVariabilityRef.current.shift();
    }
    
    // Update arrhythmia state
    lastIsArrhythmiaRef.current = isArrhythmia;
    currentBeatIsArrhythmiaRef.current = isArrhythmia;
    
    return {
      rmssd,
      rrVariation: variationRatio,
      timestamp: Date.now(),
      isArrhythmia
    };
  }, []);
  
  /**
   * Reset all detectors and counters
   */
  const reset = useCallback(() => {
    heartRateVariabilityRef.current = [];
    stabilityCounterRef.current = 0;
    lastRRIntervalsRef.current = [];
    lastIsArrhythmiaRef.current = false;
    currentBeatIsArrhythmiaRef.current = false;
  }, []);
  
  return {
    detectArrhythmia,
    heartRateVariabilityRef,
    stabilityCounterRef,
    lastRRIntervalsRef,
    lastIsArrhythmiaRef,
    currentBeatIsArrhythmiaRef,
    reset
  };
}

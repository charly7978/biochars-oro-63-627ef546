
import { useCallback, useRef } from 'react';

interface ArrhythmiaResult {
  isArrhythmia: boolean;
  confidence: number;
}

export const useArrhythmiaDetector = () => {
  const heartRateVariabilityRef = useRef<number[]>([]);
  const stabilityCounterRef = useRef<number>(0);
  const lastRRIntervalsRef = useRef<number[]>([]);
  const lastIsArrhythmiaRef = useRef<boolean>(false);
  const currentBeatIsArrhythmiaRef = useRef<boolean>(false);
  
  const detectArrhythmia = useCallback((rrIntervals: number[]): ArrhythmiaResult => {
    if (rrIntervals.length < 3) {
      return { isArrhythmia: false, confidence: 0 };
    }

    // Calculate RR interval variability
    const variability = [];
    for (let i = 1; i < rrIntervals.length; i++) {
      const prevInterval = rrIntervals[i-1];
      const currentInterval = rrIntervals[i];
      const percentVariation = Math.abs(currentInterval - prevInterval) / prevInterval * 100;
      variability.push(percentVariation);
    }

    // Store the last variability values
    heartRateVariabilityRef.current = [...variability];
    if (heartRateVariabilityRef.current.length > 10) {
      heartRateVariabilityRef.current = heartRateVariabilityRef.current.slice(-10);
    }
    
    // Check if recent variability exceeds threshold
    const recentVariability = heartRateVariabilityRef.current.slice(-3);
    const avgVariability = recentVariability.reduce((sum, val) => sum + val, 0) / recentVariability.length;
    
    const HIGH_VARIABILITY_THRESHOLD = 20; // 20% variation threshold
    const isHighVariability = avgVariability > HIGH_VARIABILITY_THRESHOLD;
    
    // Update arrhythmia stability counter
    if (isHighVariability) {
      stabilityCounterRef.current += 1;
    } else {
      stabilityCounterRef.current = Math.max(0, stabilityCounterRef.current - 1);
    }
    
    // Declare arrhythmia if consistent high variability
    const ARRHYTHMIA_STABILITY_THRESHOLD = 3;
    const isArrhythmia = stabilityCounterRef.current >= ARRHYTHMIA_STABILITY_THRESHOLD;
    
    const confidence = Math.min(1.0, stabilityCounterRef.current / ARRHYTHMIA_STABILITY_THRESHOLD);
    
    lastIsArrhythmiaRef.current = isArrhythmia;
    return { isArrhythmia, confidence };
  }, []);

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
};

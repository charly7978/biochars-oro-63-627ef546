
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useCallback, useRef } from 'react';
import { calculateRMSSD, calculateRRVariation } from '../../modules/vital-signs/arrhythmia/calculations';

/**
 * Hook for arrhythmia detection based on real RR interval data
 * No simulation or data manipulation is used - direct measurement only
 */
export function useArrhythmiaDetector() {
  const heartRateVariabilityRef = useRef<number[]>([]);
  const stabilityCounterRef = useRef<number>(0);
  const lastRRIntervalsRef = useRef<number[]>([]);
  const lastIsArrhythmiaRef = useRef<boolean>(false);
  const currentBeatIsArrhythmiaRef = useRef<boolean>(false);
  const arrhythmiaCountRef = useRef<number>(0);

  /**
   * Analyze real RR intervals to detect arrhythmias 
   * Using direct measurement algorithms only
   */
  const detectArrhythmia = useCallback((rrIntervals: number[]) => {
    if (rrIntervals.length < 5) {
      return {
        rmssd: 0,
        rrVariation: 0,
        timestamp: Date.now(),
        isArrhythmia: false
      };
    }
    
    const lastIntervals = rrIntervals.slice(-5);
    
    // Calculate RMSSD (Root Mean Square of Successive Differences)
    const rmssd = calculateRMSSD(lastIntervals);
    
    // Calculate RR variation
    const variationRatio = calculateRRVariation(lastIntervals);
    
    // More relaxed threshold to improve detection rate
    let thresholdFactor = 0.20; // Lower than before to detect more arrhythmias
    if (stabilityCounterRef.current > 15) {
      thresholdFactor = 0.15; // Even lower for established patterns
    } else if (stabilityCounterRef.current < 5) {
      thresholdFactor = 0.25; // A bit higher at the beginning
    }
    
    // Check if we need to tweak the detection based on historical data
    if (heartRateVariabilityRef.current.length > 5) {
      const avgVar = heartRateVariabilityRef.current.reduce((a, b) => a + b, 0) / 
                   heartRateVariabilityRef.current.length;
      if (avgVar < 0.05) {
        // Very regular heart rate, need more variation to detect arrhythmia
        thresholdFactor = 0.30;
      }
    }
    
    const isIrregular = variationRatio > thresholdFactor;
    
    if (!isIrregular) {
      stabilityCounterRef.current = Math.min(30, stabilityCounterRef.current + 1);
    } else {
      stabilityCounterRef.current = Math.max(0, stabilityCounterRef.current - 2);
    }
    
    // IMPORTANT: Report arrhythmia immediately if the variation is very high
    let isArrhythmia = isIrregular && (variationRatio > 0.35 || stabilityCounterRef.current > 8); 
    
    // Track if we had an arrhythmia before
    const wasArrhythmia = lastIsArrhythmiaRef.current;
    
    // Count arrhythmias
    if (isArrhythmia && !wasArrhythmia) {
      arrhythmiaCountRef.current++;
      // Log that we detected an arrhythmia
      console.log(`Arrhythmia detected! Count: ${arrhythmiaCountRef.current}, Variation: ${variationRatio.toFixed(2)}`);
    }
    
    // Update state
    lastIsArrhythmiaRef.current = isArrhythmia;
    
    heartRateVariabilityRef.current.push(variationRatio);
    if (heartRateVariabilityRef.current.length > 20) {
      heartRateVariabilityRef.current.shift();
    }
    
    return {
      rmssd,
      rrVariation: variationRatio,
      timestamp: Date.now(),
      isArrhythmia,
      arrhythmiaCount: arrhythmiaCountRef.current
    };
  }, []);

  /**
   * Reset all tracking data
   */
  const reset = useCallback(() => {
    heartRateVariabilityRef.current = [];
    stabilityCounterRef.current = 0;
    lastRRIntervalsRef.current = [];
    lastIsArrhythmiaRef.current = false;
    currentBeatIsArrhythmiaRef.current = false;
    arrhythmiaCountRef.current = 0;
  }, []);

  return {
    detectArrhythmia,
    heartRateVariabilityRef,
    stabilityCounterRef,
    lastRRIntervalsRef,
    lastIsArrhythmiaRef,
    currentBeatIsArrhythmiaRef,
    arrhythmiaCountRef,
    reset
  };
}


/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useRef, useCallback } from 'react';
import { checkWeakSignal, shouldProcessMeasurement } from './signal-processing';
import { VitalSignsConfig } from '../../core/config/VitalSignsConfig';
import { HeartBeatResult } from './types';
import { toast } from 'sonner';

/**
 * Hook for processing heart beat signals
 */
export const useSignalProcessor = () => {
  // Signal quality tracking
  const consecutiveWeakSignalsRef = useRef<number>(0);
  const MAX_CONSECUTIVE_WEAK_SIGNALS = VitalSignsConfig.fingerDetection.MAX_WEAK_SIGNALS;
  
  // Heart rate tracking
  const lastPeakTimeRef = useRef<number | null>(null);
  const lastValidBpmRef = useRef<number>(0);
  
  // Signal quality tracking
  const lastSignalQualityRef = useRef<number>(0);
  
  // Additional tracking for vital sign stability
  const rrIntervalsRef = useRef<number[]>([]);
  const lastHeartRateUpdateRef = useRef<number>(0);
  const heartRateConfidenceRef = useRef<number>(0);
  
  /**
   * Process PPG signal to detect heart beats and calculate metrics
   * Only direct measurement is used
   */
  const processSignal = useCallback(
    (
      value: number,
      currentBPM: number,
      confidence: number,
      processor: any,
      requestBeep: (value: number) => boolean,
      isMonitoringRef: React.MutableRefObject<boolean>,
      lastRRIntervalsRef: React.MutableRefObject<number[]>,
      currentBeatIsArrhythmiaRef: React.MutableRefObject<boolean>
    ): HeartBeatResult => {
      // Check if signal is weak using centralized function
      const { isWeak, updatedCount } = checkWeakSignal(
        value,
        consecutiveWeakSignalsRef.current,
        MAX_CONSECUTIVE_WEAK_SIGNALS
      );
      
      consecutiveWeakSignalsRef.current = updatedCount;
      
      // Initialize result object
      const result: HeartBeatResult = {
        bpm: currentBPM,
        confidence,
        isPeak: false,
        arrhythmiaCount: 0,
        rrData: {
          intervals: lastRRIntervalsRef.current.slice(),
          lastPeakTime: lastPeakTimeRef.current
        }
      };
      
      // Return early if signal is weak or monitoring is off
      if (isWeak || !isMonitoringRef.current) {
        return result;
      }
      
      // Process for heart beat detection
      if (processor) {
        // Internal peak detection
        const now = Date.now();
        const isPeak = processor.detectPeak(value);
        
        if (isPeak) {
          // Real heart beat detected
          const MINIMUM_VALID_RR_INTERVAL = VitalSignsConfig.arrhythmia.DATA.MIN_INTERVAL_MS;
          
          // Calculate interval since last peak
          if (lastPeakTimeRef.current) {
            const interval = now - lastPeakTimeRef.current;
            
            // Validate interval is physiologically plausible
            if (interval >= MINIMUM_VALID_RR_INTERVAL) {
              // Add to RR intervals array for arrhythmia analysis
              lastRRIntervalsRef.current.push(interval);
              rrIntervalsRef.current.push(interval);
              
              // Maintain array size
              if (lastRRIntervalsRef.current.length > 10) {
                lastRRIntervalsRef.current.shift();
              }
              
              if (rrIntervalsRef.current.length > 20) {
                rrIntervalsRef.current.shift();
              }
              
              // Calculate BPM from RR intervals for greater stability
              if (rrIntervalsRef.current.length >= 3) {
                // Use recent intervals for calculation
                const recentIntervals = rrIntervalsRef.current.slice(-5);
                const avgRR = recentIntervals.reduce((sum, rr) => sum + rr, 0) / recentIntervals.length;
                
                // Calculate heart rate in BPM
                const calculatedBPM = Math.round(60000 / avgRR);
                
                // Validate physiological plausibility
                if (calculatedBPM >= 40 && calculatedBPM <= 200) {
                  // Adaptive confidence based on interval consistency
                  const intervalStdDev = calculateStandardDeviation(recentIntervals);
                  const normalizedStdDev = intervalStdDev / avgRR;
                  
                  // Higher consistency = higher confidence
                  const calculatedConfidence = 1 - Math.min(1, normalizedStdDev);
                  
                  result.bpm = calculatedBPM;
                  result.confidence = Math.max(0.4, calculatedConfidence);
                  
                  // Update refs for future use
                  lastValidBpmRef.current = calculatedBPM;
                  heartRateConfidenceRef.current = calculatedConfidence;
                  lastHeartRateUpdateRef.current = now;
                  
                  // Trigger beep for heart beat
                  if (isMonitoringRef.current) {
                    requestBeep(value);
                  }
                }
              }
            }
          }
          
          // Update last peak time regardless of interval validity
          lastPeakTimeRef.current = now;
          result.isPeak = true;
        }
        
        // Update RR data for result
        result.rrData = {
          intervals: lastRRIntervalsRef.current.slice(),
          lastPeakTime: lastPeakTimeRef.current
        };
        
        // Update signal quality reference
        lastSignalQualityRef.current = processor.getSignalQuality();
      }
      
      return result;
    },
    []
  );
  
  /**
   * Reset all processor state
   */
  const reset = useCallback(() => {
    consecutiveWeakSignalsRef.current = 0;
    lastPeakTimeRef.current = null;
    lastValidBpmRef.current = 0;
    lastSignalQualityRef.current = 0;
    rrIntervalsRef.current = [];
    lastHeartRateUpdateRef.current = 0;
    heartRateConfidenceRef.current = 0;
    console.log("HeartBeat signal processor reset");
  }, []);
  
  return {
    processSignal,
    reset,
    lastPeakTimeRef,
    lastValidBpmRef,
    lastSignalQualityRef,
    consecutiveWeakSignalsRef,
    MAX_CONSECUTIVE_WEAK_SIGNALS,
  };
};

/**
 * Calculate standard deviation of array values
 */
function calculateStandardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  
  return Math.sqrt(variance);
}

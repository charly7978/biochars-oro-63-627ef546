/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useRef, useState, useCallback } from 'react';
import { checkSignalQuality } from '../../modules/heart-beat/signal-quality';

/**
 * Enhanced hook that detects finger presence based on consistent rhythmic patterns
 * Uses physiological characteristics of human finger (heartbeat patterns)
 * IMPROVED: Much stricter thresholds to prevent false positives
 */
export const useSignalQualityDetector = () => {
  // Reference counter for compatibility
  const consecutiveWeakSignalsRef = useRef<number>(0);
  
  // INCREASED thresholds to reduce false positives significantly
  const WEAK_SIGNAL_THRESHOLD = 0.45; // Increased from 0.25 to 0.45
  const MAX_CONSECUTIVE_WEAK_SIGNALS = 6; // Increased from 5 to 6
  
  // Signal pattern detection for finger presence
  const signalHistoryRef = useRef<Array<{time: number, value: number}>>([]);
  const lastPeakTimesRef = useRef<number[]>([]);
  const detectedRhythmicPatternsRef = useRef<number>(0);
  const fingerDetectionConfirmedRef = useRef<boolean>(false);
  
  // Constants for pattern detection - made MUCH more strict
  const PATTERN_DETECTION_WINDOW_MS = 3500; // Increased from 3000 to 3500
  const MIN_PEAKS_FOR_RHYTHM = 5; // Increased from 4 to 5
  const PEAK_DETECTION_THRESHOLD = 0.35; // Increased from 0.25 to 0.35
  const REQUIRED_CONSISTENT_PATTERNS = 6; // Increased from 4 to 6
  const MIN_SIGNAL_VARIANCE = 0.06; // Increased from 0.04 to 0.06
  
  // New parameters for more robust detection
  const CORRELATION_THRESHOLD = 0.35; // Min correlation between consecutive signals
  const WARMUP_PERIOD_MS = 1500; // Require 1.5s of consistent signal before confirming
  const FAST_DECAY_FACTOR = 3;  // Faster decay for lost detection
  const TEMPORAL_CONSISTENCY_RATIO = 0.7; // Require 70% of intervals to be consistent
  const MAX_ALLOWABLE_RR_VARIANCE = 0.3; // Max allowable variance in RR intervals (30%)
  
  /**
   * Detect peaks in the signal history with stricter physiological validation
   */
  const detectPeaks = useCallback(() => {
    const now = Date.now();
    const recentSignals = signalHistoryRef.current
      .filter(point => now - point.time < PATTERN_DETECTION_WINDOW_MS);
    
    if (recentSignals.length < 20) return false; // Increased minimum data points (15 to 20)
    
    // Check for minimum signal variance (reject near-constant signals)
    const values = recentSignals.map(s => s.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    if (variance < MIN_SIGNAL_VARIANCE) {
      // Signal variance too low - likely not a physiological signal
      detectedRhythmicPatternsRef.current = Math.max(0, detectedRhythmicPatternsRef.current - 1);
      console.log("Signal variance too low - rejecting pattern", { variance, threshold: MIN_SIGNAL_VARIANCE });
      return false;
    }

    // NEW: Check temporal correlation to detect random patterns
    let correlationSum = 0;
    for (let i = 1; i < values.length; i++) {
      const diff = Math.abs(values[i] - values[i-1]);
      const maxVal = Math.max(Math.abs(values[i]), Math.abs(values[i-1]));
      if (maxVal > 0) {
        correlationSum += diff / maxVal;
      }
    }
    const avgCorrelation = correlationSum / (values.length - 1);
    
    // If signal changes too rapidly or randomly, reject it
    if (avgCorrelation > (1 - CORRELATION_THRESHOLD)) {
      detectedRhythmicPatternsRef.current = Math.max(0, detectedRhythmicPatternsRef.current - 1);
      console.log("Signal correlation too low - rejecting pattern", { correlation: 1 - avgCorrelation, threshold: CORRELATION_THRESHOLD });
      return false;
    }
    
    // Look for peaks in the recent signal with stricter criteria
    const peaks: number[] = [];
    
    for (let i = 2; i < recentSignals.length - 2; i++) {
      const current = recentSignals[i];
      const prev1 = recentSignals[i - 1];
      const prev2 = recentSignals[i - 2];
      const next1 = recentSignals[i + 1];
      const next2 = recentSignals[i + 2];
      
      // Check if this point is a peak (higher than surrounding points)
      // Also require the peak to be significantly higher (25% higher, up from 20%)
      if (current.value > prev1.value * 1.25 && 
          current.value > prev2.value * 1.25 &&
          current.value > next1.value * 1.25 && 
          current.value > next2.value * 1.25 &&
          Math.abs(current.value) > PEAK_DETECTION_THRESHOLD) {
        peaks.push(current.time);
      }
    }
    
    // Check if we have enough peaks to detect a pattern
    if (peaks.length >= MIN_PEAKS_FOR_RHYTHM) {
      // Calculate intervals between peaks
      const intervals: number[] = [];
      for (let i = 1; i < peaks.length; i++) {
        intervals.push(peaks[i] - peaks[i - 1]);
      }
      
      // Check for physiologically plausible heart rate (40-180 BPM)
      const validIntervals = intervals.filter(interval => 
        interval >= 333 && interval <= 1500 // 40-180 BPM
      );
      
      // NEW: More strict validation - require 70% of intervals to be physiologically valid
      if (validIntervals.length < Math.floor(intervals.length * TEMPORAL_CONSISTENCY_RATIO)) {
        // If less than 70% of intervals are physiologically plausible, reject the pattern
        detectedRhythmicPatternsRef.current = Math.max(0, detectedRhythmicPatternsRef.current - FAST_DECAY_FACTOR);
        console.log("Intervals not physiologically plausible - rejecting pattern", { 
          validCount: validIntervals.length, 
          totalCount: intervals.length 
        });
        return false;
      }
      
      // NEW: Check for variance in RR intervals - real heartbeats have limited variance
      if (validIntervals.length > 2) {
        const avgInterval = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
        const intervalVariance = validIntervals.reduce((sum, val) => 
          sum + Math.pow((val - avgInterval) / avgInterval, 2), 0) / validIntervals.length;
        
        if (intervalVariance > MAX_ALLOWABLE_RR_VARIANCE) {
          // Too much variance in RR intervals - not likely to be real heartbeats
          detectedRhythmicPatternsRef.current = Math.max(0, detectedRhythmicPatternsRef.current - FAST_DECAY_FACTOR);
          console.log("RR interval variance too high - rejecting pattern", { 
            intervalVariance, 
            threshold: MAX_ALLOWABLE_RR_VARIANCE 
          });
          return false;
        }
      }
      
      // Check for consistency in intervals (rhythm)
      let consistentIntervals = 0;
      const maxDeviation = 130; // Reduced from 150ms - tighter consistency check
      
      for (let i = 1; i < validIntervals.length; i++) {
        if (Math.abs(validIntervals[i] - validIntervals[i - 1]) < maxDeviation) {
          consistentIntervals++;
        }
      }
      
      // If we have consistent intervals, increment the pattern counter
      if (consistentIntervals >= MIN_PEAKS_FOR_RHYTHM - 1) {
        lastPeakTimesRef.current = peaks;
        detectedRhythmicPatternsRef.current++;
        
        console.log("Consistent rhythm detected", {
          consistentIntervals,
          totalValidIntervals: validIntervals.length,
          peakCount: peaks.length,
          meanInterval: validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length,
          patternCount: detectedRhythmicPatternsRef.current
        });
        
        // If we've detected enough consistent patterns, confirm finger detection
        // NEW: Also verify minimum warmup period has elapsed
        const firstPeakTime = peaks[0];
        const lastPeakTime = peaks[peaks.length - 1];
        const signalDuration = lastPeakTime - firstPeakTime;
        
        if (detectedRhythmicPatternsRef.current >= REQUIRED_CONSISTENT_PATTERNS && 
            signalDuration >= WARMUP_PERIOD_MS) {
          fingerDetectionConfirmedRef.current = true;
          console.log("Finger detection confirmed by consistent rhythm", {
            time: new Date(now).toISOString(),
            patternCount: detectedRhythmicPatternsRef.current,
            peaks: peaks.length,
            signalDuration
          });
          return true;
        }
      } else {
        // Reduce the counter if pattern is not consistent - faster decay
        detectedRhythmicPatternsRef.current = Math.max(0, detectedRhythmicPatternsRef.current - FAST_DECAY_FACTOR);
      }
    } else {
      // Decrement pattern count if we don't have enough peaks - faster decay
      detectedRhythmicPatternsRef.current = Math.max(0, detectedRhythmicPatternsRef.current - FAST_DECAY_FACTOR);
    }
    
    return fingerDetectionConfirmedRef.current;
  }, []);
  
  /**
   * Enhanced detection function with physiological pattern recognition
   */
  const detectWeakSignal = (value: number): boolean => {
    const now = Date.now();
    
    // Add current value to signal history
    signalHistoryRef.current.push({ time: now, value });
    
    // Keep only recent signals
    signalHistoryRef.current = signalHistoryRef.current.filter(
      point => now - point.time < PATTERN_DETECTION_WINDOW_MS * 2
    );
    
    // If finger detection is already confirmed, use standard weak signal detection
    // with higher threshold to maintain the detection
    if (fingerDetectionConfirmedRef.current) {
      if (Math.abs(value) < WEAK_SIGNAL_THRESHOLD) {
        consecutiveWeakSignalsRef.current++;
        
        // If many consecutive weak signals, we may need to reset the finger detection
        // Faster loss of detection when signal is weak
        if (consecutiveWeakSignalsRef.current > MAX_CONSECUTIVE_WEAK_SIGNALS * FAST_DECAY_FACTOR) {
          fingerDetectionConfirmedRef.current = false;
          detectedRhythmicPatternsRef.current = 0;
        }
      } else {
        // Faster recovery from false positives by reducing count more quickly
        consecutiveWeakSignalsRef.current = Math.max(0, consecutiveWeakSignalsRef.current - FAST_DECAY_FACTOR);
      }
      
      return consecutiveWeakSignalsRef.current >= MAX_CONSECUTIVE_WEAK_SIGNALS;
    } 
    // Otherwise try to detect finger through rhythmic patterns
    else {
      // Use standard weak signal detection alongside pattern detection
      if (Math.abs(value) < WEAK_SIGNAL_THRESHOLD) {
        consecutiveWeakSignalsRef.current++;
      } else {
        consecutiveWeakSignalsRef.current = Math.max(0, consecutiveWeakSignalsRef.current - FAST_DECAY_FACTOR);
      }
      
      // Attempt to detect rhythmic patterns
      const hasRhythmicPattern = detectPeaks();
      
      // If we detected a rhythm, we can consider the signal as strong
      if (hasRhythmicPattern) {
        consecutiveWeakSignalsRef.current = 0;
        return false;
      }
      
      return consecutiveWeakSignalsRef.current >= MAX_CONSECUTIVE_WEAK_SIGNALS;
    }
  };
  
  /**
   * Check if finger is detected based on rhythmic patterns
   */
  const isFingerDetected = useCallback((): boolean => {
    // If we've already confirmed finger detection, maintain it unless 
    // we get too many weak signals
    if (fingerDetectionConfirmedRef.current) {
      return consecutiveWeakSignalsRef.current < MAX_CONSECUTIVE_WEAK_SIGNALS * FAST_DECAY_FACTOR;
    }
    
    // Otherwise, check if we've detected enough rhythmic patterns
    return detectedRhythmicPatternsRef.current >= REQUIRED_CONSISTENT_PATTERNS;
  }, []);
  
  /**
   * Reset the signal quality detector
   */
  const reset = () => {
    consecutiveWeakSignalsRef.current = 0;
    signalHistoryRef.current = [];
    lastPeakTimesRef.current = [];
    detectedRhythmicPatternsRef.current = 0;
    fingerDetectionConfirmedRef.current = false;
  };
  
  return {
    detectWeakSignal,
    isFingerDetected,
    reset,
    consecutiveWeakSignalsRef,
    WEAK_SIGNAL_THRESHOLD,
    MAX_CONSECUTIVE_WEAK_SIGNALS,
    signalHistoryRef,
    lastPeakTimesRef,
    detectedRhythmicPatternsRef,
    fingerDetectionConfirmedRef
  };
};


/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useRef, useState, useCallback } from 'react';
import { checkSignalQuality } from '../../modules/heart-beat/signal-quality';

/**
 * Enhanced hook that detects finger presence based on consistent rhythmic patterns
 * Uses physiological characteristics of human finger (heartbeat patterns)
 */
export const useSignalQualityDetector = () => {
  // Reference counter for compatibility
  const consecutiveWeakSignalsRef = useRef<number>(0);
  
  // Increased thresholds to reduce false positives
  const WEAK_SIGNAL_THRESHOLD = 0.25; // Increased from 0.15
  const MAX_CONSECUTIVE_WEAK_SIGNALS = 5; // Increased from 4
  
  // Signal pattern detection for finger presence
  const signalHistoryRef = useRef<Array<{time: number, value: number}>>([]);
  const lastPeakTimesRef = useRef<number[]>([]);
  const detectedRhythmicPatternsRef = useRef<number>(0);
  const fingerDetectionConfirmedRef = useRef<boolean>(false);
  
  // Constants for pattern detection - made more strict
  const PATTERN_DETECTION_WINDOW_MS = 3000; // 3 seconds window for pattern detection
  const MIN_PEAKS_FOR_RHYTHM = 4; // Increased from 3 - need more peaks
  const PEAK_DETECTION_THRESHOLD = 0.25; // Increased from 0.2
  const REQUIRED_CONSISTENT_PATTERNS = 4; // Increased from 3
  const MIN_SIGNAL_VARIANCE = 0.04; // New: minimum variance threshold to reject noise
  
  /**
   * Detect peaks in the signal history
   */
  const detectPeaks = useCallback(() => {
    const now = Date.now();
    const recentSignals = signalHistoryRef.current
      .filter(point => now - point.time < PATTERN_DETECTION_WINDOW_MS);
    
    if (recentSignals.length < 15) return false; // Need more data points (increased from 10)
    
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
    
    // Look for peaks in the recent signal
    const peaks: number[] = [];
    
    for (let i = 2; i < recentSignals.length - 2; i++) {
      const current = recentSignals[i];
      const prev1 = recentSignals[i - 1];
      const prev2 = recentSignals[i - 2];
      const next1 = recentSignals[i + 1];
      const next2 = recentSignals[i + 2];
      
      // Check if this point is a peak (higher than surrounding points)
      // Also require the peak to be significantly higher (20% higher)
      if (current.value > prev1.value * 1.2 && 
          current.value > prev2.value * 1.2 &&
          current.value > next1.value * 1.2 && 
          current.value > next2.value * 1.2 &&
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
      
      if (validIntervals.length < Math.floor(intervals.length * 0.7)) {
        // If less than 70% of intervals are physiologically plausible, reject the pattern
        detectedRhythmicPatternsRef.current = Math.max(0, detectedRhythmicPatternsRef.current - 1);
        console.log("Intervals not physiologically plausible - rejecting pattern", { 
          validCount: validIntervals.length, 
          totalCount: intervals.length 
        });
        return false;
      }
      
      // Check for consistency in intervals (rhythm)
      let consistentIntervals = 0;
      const maxDeviation = 150; // Reduced from 200ms - tighter consistency check
      
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
        if (detectedRhythmicPatternsRef.current >= REQUIRED_CONSISTENT_PATTERNS) {
          fingerDetectionConfirmedRef.current = true;
          console.log("Finger detection confirmed by consistent rhythm", {
            time: new Date(now).toISOString(),
            patternCount: detectedRhythmicPatternsRef.current,
            peaks: peaks.length
          });
          return true;
        }
      } else {
        // Reduce the counter if pattern is not consistent
        detectedRhythmicPatternsRef.current = Math.max(0, detectedRhythmicPatternsRef.current - 1);
      }
    } else {
      // Decrement pattern count if we don't have enough peaks
      detectedRhythmicPatternsRef.current = Math.max(0, detectedRhythmicPatternsRef.current - 1);
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
        if (consecutiveWeakSignalsRef.current > MAX_CONSECUTIVE_WEAK_SIGNALS * 2) {
          fingerDetectionConfirmedRef.current = false;
          detectedRhythmicPatternsRef.current = 0;
        }
      } else {
        // Faster recovery from false positives by reducing count more quickly
        consecutiveWeakSignalsRef.current = Math.max(0, consecutiveWeakSignalsRef.current - 2);
      }
      
      return consecutiveWeakSignalsRef.current >= MAX_CONSECUTIVE_WEAK_SIGNALS;
    } 
    // Otherwise try to detect finger through rhythmic patterns
    else {
      // Use standard weak signal detection alongside pattern detection
      if (Math.abs(value) < WEAK_SIGNAL_THRESHOLD) {
        consecutiveWeakSignalsRef.current++;
      } else {
        consecutiveWeakSignalsRef.current = Math.max(0, consecutiveWeakSignalsRef.current - 2);
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
      return consecutiveWeakSignalsRef.current < MAX_CONSECUTIVE_WEAK_SIGNALS * 2;
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

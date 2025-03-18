
/**
 * Signal quality utility functions for heart beat signals
 * DIRECT MEASUREMENT ONLY - NO SIMULATION OR MANIPULATION WHATSOEVER
 */

// Signal quality thresholds with drastically increased values
const GOOD_QUALITY_THRESHOLD = 85; // Drastically increased from 70
const ACCEPTABLE_QUALITY_THRESHOLD = 60; // Drastically increased from 45 
const MIN_SIGNAL_STRENGTH = 0.4; // Much higher threshold (increased from 0.25)

// Pattern detection constants - much stricter
const PATTERN_WINDOW_MS = 3000; // 3-second window for pattern detection
const MIN_PEAKS_FOR_PATTERN = 5; // Increased from 4 - require more peaks
const REQUIRED_PATTERNS = 6; // Increased from 4 - require more patterns
const MIN_PEAK_HEIGHT = 0.5; // Much higher peak threshold

/**
 * Get color class based on signal quality
 */
export const getQualityColor = (isArrhythmia: boolean): string => {
  return isArrhythmia ? '#FF2E2E' : '#0EA5E9';
};

/**
 * Calculate weighted quality from an array of quality values
 * Uses only direct measurements with no manipulation
 */
export const calculateWeightedQuality = (qualityValues: number[]): number => {
  if (qualityValues.length === 0) return 0;
  
  let weightedSum = 0;
  let weightSum = 0;
  
  qualityValues.forEach((quality, index) => {
    const weight = index + 1;
    weightedSum += quality * weight;
    weightSum += weight;
  });
  
  return weightSum > 0 ? weightedSum / weightSum : 0;
};

/**
 * Get quality description text based on signal quality value
 */
export const getQualityText = (quality: number, isFingerDetected: boolean): string => {
  if (!isFingerDetected) return 'Sin detección';
  if (quality > GOOD_QUALITY_THRESHOLD) return 'Señal óptima';
  if (quality > ACCEPTABLE_QUALITY_THRESHOLD) return 'Señal aceptable';
  return 'Señal débil';
};

/**
 * Check signal quality and track consecutive weak signals
 * Works only with direct measured values, no simulation whatsoever
 * Drastically improved false positive resistance with much higher thresholds
 */
export const checkSignalQuality = (
  signalValue: number,
  currentWeakSignalsCount: number,
  options?: {
    lowSignalThreshold?: number;
    maxWeakSignalCount?: number;
  }
): { isWeakSignal: boolean; updatedWeakSignalsCount: number } => {
  // Much higher default thresholds to eliminate false positives
  const threshold = options?.lowSignalThreshold || 0.4; // Drastically increased from 0.25
  const maxWeakSignals = options?.maxWeakSignalCount || 3; // Reduced for faster detection of finger removal
  
  // Much stricter detection to eliminate false positives
  const isWeak = Math.abs(signalValue) < threshold;
  let updatedCount = currentWeakSignalsCount;
  
  if (isWeak) {
    updatedCount = Math.min(maxWeakSignals, updatedCount + 1);
  } else {
    // Faster decrease to recover from false weak signals
    updatedCount = Math.max(0, updatedCount - 2);
  }
  
  // More aggressive threshold with lower maxWeakSignals
  return {
    isWeakSignal: updatedCount >= maxWeakSignals,
    updatedWeakSignalsCount: updatedCount
  };
};

/**
 * Drastically enhanced function to check if a finger is detected based on rhythmic patterns
 * Uses strict physiological characteristics of a human finger (pulse pattern)
 * ZERO simulation - ONLY real finger detection
 */
export const isFingerDetectedByPattern = (
  signalHistory: Array<{time: number, value: number}>,
  previousPatternCount: number = 0
): {
  isFingerDetected: boolean,
  patternCount: number,
  peakTimes: number[]
} => {
  const now = Date.now();
  const recentSignals = signalHistory
    .filter(point => now - point.time < PATTERN_WINDOW_MS);
  
  if (recentSignals.length < 20) { // Drastically increased minimum required data points
    return { 
      isFingerDetected: false, // Never maintain detection with insufficient data
      patternCount: 0,  // Reset pattern count with insufficient data
      peakTimes: []
    }; 
  }
  
  // Verify signal has sufficient amplitude (real finger requirement)
  const values = recentSignals.map(s => s.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const amplitude = maxVal - minVal;
  
  if (amplitude < 0.35) { // Much higher amplitude requirement
    return {
      isFingerDetected: false,
      patternCount: 0, // Reset when amplitude is too low
      peakTimes: []
    };
  }
  
  // Calculate signal variance (real fingers show physiological variance)
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  
  // Require minimum physiological variance
  if (variance < 0.05) {
    return {
      isFingerDetected: false,
      patternCount: 0, // Reset when variance is too low
      peakTimes: []
    };
  }
  
  // Look for peaks in the recent signal - much stricter criteria
  const peaks: number[] = [];
  
  for (let i = 2; i < recentSignals.length - 2; i++) {
    const current = recentSignals[i];
    const prev1 = recentSignals[i - 1];
    const prev2 = recentSignals[i - 2];
    const next1 = recentSignals[i + 1];
    const next2 = recentSignals[i + 2];
    
    // Much stricter peak detection criteria
    if (current.value > prev1.value * 1.4 && // Must be 40% higher than neighbors (increased from 20%)
        current.value > prev2.value * 1.4 &&
        current.value > next1.value * 1.4 && 
        current.value > next2.value * 1.4 &&
        Math.abs(current.value) > MIN_PEAK_HEIGHT) { // Much higher peak requirement
      peaks.push(current.time);
    }
  }
  
  // Check if we have enough peaks to detect a pattern
  if (peaks.length >= MIN_PEAKS_FOR_PATTERN) {
    // Calculate intervals between peaks
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }
    
    // Check for physiologically plausible heart rate (40-180 BPM)
    // More strict: require 85% of intervals to be valid (increased from 70%)
    const validIntervals = intervals.filter(interval => 
      interval >= 333 && interval <= 1500 // 40-180 BPM
    );
    
    if (validIntervals.length < Math.floor(intervals.length * 0.85)) {
      // If less than 85% of intervals are physiologically plausible, reject the pattern
      return {
        isFingerDetected: false,
        patternCount: 0, // Reset counter when intervals aren't valid enough
        peakTimes: []
      };
    }
    
    // Require tighter consistency in intervals (rhythm)
    let consistentIntervals = 0;
    const maxDeviation = 120; // Reduced from 150ms - much tighter consistency check
    
    for (let i = 1; i < validIntervals.length; i++) {
      if (Math.abs(validIntervals[i] - validIntervals[i - 1]) < maxDeviation) {
        consistentIntervals++;
      }
    }
    
    // Require more consistent intervals (75% instead of just a fixed number)
    const requiredConsistentIntervals = Math.floor(validIntervals.length * 0.75);
    
    // If we have enough consistent intervals, increment the pattern counter
    let updatedPatternCount = 0; // Always start from zero - never rely on previous
    
    if (consistentIntervals >= requiredConsistentIntervals && consistentIntervals >= MIN_PEAKS_FOR_PATTERN - 1) {
      updatedPatternCount = 1; // Just count this as one pattern
      
      console.log("Strict rhythm detection: Valid pattern found", {
        consistentIntervals,
        requiredConsistentIntervals,
        totalValidIntervals: validIntervals.length,
        peakCount: peaks.length,
        meanInterval: validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length,
        amplitude,
        variance
      });
    }
    
    // Require much more patterns to confirm finger detection
    const fingerDetected = updatedPatternCount >= REQUIRED_PATTERNS;
    
    return {
      isFingerDetected: fingerDetected,
      patternCount: updatedPatternCount,
      peakTimes: peaks
    };
  }
  
  return {
    isFingerDetected: false,
    patternCount: 0, // Always reset when not enough peaks
    peakTimes: []
  };
};

/**
 * Reset detection states for signal quality detection
 * Used to reset any accumulating detection states
 * No simulation or calibration data used
 */
export const resetDetectionStates = (): void => {
  console.log("Signal quality detection states reset - direct measurement only, no simulation");
};

/**
 * Check if a point is in an arrhythmia window
 * Used by PPGSignalMeter for visualization
 * Works only with real detected arrhythmias - no simulation
 */
export const isPointInArrhythmiaWindow = (
  pointTime: number, 
  arrhythmiaWindows: {start: number, end: number}[]
): boolean => {
  return arrhythmiaWindows.some(window => 
    pointTime >= window.start && pointTime <= window.end
  );
};

/**
 * Determine if a measurement should be processed based on signal strength
 * Drastically increased threshold to eliminate false positives
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Much higher threshold to avoid processing weak signals (likely noise)
  return Math.abs(value) >= MIN_SIGNAL_STRENGTH;
}

/**
 * Creates default signal processing result when signal is too weak
 * Keeps compatibility with existing code
 */
export function createWeakSignalResult(arrhythmiaCounter: number = 0): any {
  return {
    bpm: 0,
    confidence: 0,
    isPeak: false,
    arrhythmiaCount: arrhythmiaCounter || 0,
    rrData: {
      intervals: [],
      lastPeakTime: null
    }
  };
}


/**
 * Signal quality utility functions for heart beat signals
 * DIRECT MEASUREMENT ONLY - NO SIMULATION OR MANIPULATION
 */

// Signal quality thresholds with increased values to reduce false positives
const GOOD_QUALITY_THRESHOLD = 70; // Increased from 65
const ACCEPTABLE_QUALITY_THRESHOLD = 45; // Increased from 40
const MIN_SIGNAL_STRENGTH = 0.15; // Higher threshold for signal detection

// Pattern detection constants
const PATTERN_WINDOW_MS = 3000; // 3-second window for pattern detection
const MIN_PEAKS_FOR_PATTERN = 3; // Minimum peaks to establish a pattern
const REQUIRED_PATTERNS = 3; // Required number of consistent patterns to confirm finger

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
 * Works only with direct measured values, no simulation
 * Improved false positive resistance with higher thresholds
 */
export const checkSignalQuality = (
  signalValue: number,
  currentWeakSignalsCount: number,
  options?: {
    lowSignalThreshold?: number;
    maxWeakSignalCount?: number;
  }
): { isWeakSignal: boolean; updatedWeakSignalsCount: number } => {
  // Higher default thresholds to reduce false positives
  const threshold = options?.lowSignalThreshold || 0.15; // Increased from 0.1
  const maxWeakSignals = options?.maxWeakSignalCount || 4; // Increased from 3
  
  // More strict detection to prevent false positives
  const isWeak = Math.abs(signalValue) < threshold;
  let updatedCount = currentWeakSignalsCount;
  
  // Slower increase, faster decrease for better stability
  if (isWeak) {
    updatedCount = Math.min(maxWeakSignals, updatedCount + 1);
  } else {
    // Faster decrease to recover from false weak signals
    updatedCount = Math.max(0, updatedCount - 2);
  }
  
  // More strict threshold with higher maxWeakSignals
  return {
    isWeakSignal: updatedCount >= maxWeakSignals,
    updatedWeakSignalsCount: updatedCount
  };
};

/**
 * Enhanced function to check if a finger is detected based on rhythmic patterns
 * Uses physiological characteristics of a human finger (pulse pattern)
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
  
  if (recentSignals.length < 10) {
    return { 
      isFingerDetected: previousPatternCount >= REQUIRED_PATTERNS,
      patternCount: previousPatternCount,
      peakTimes: []
    }; 
  }
  
  // Look for peaks in the recent signal
  const peaks: number[] = [];
  const peakThreshold = 0.2;
  
  for (let i = 2; i < recentSignals.length - 2; i++) {
    const current = recentSignals[i];
    const prev1 = recentSignals[i - 1];
    const prev2 = recentSignals[i - 2];
    const next1 = recentSignals[i + 1];
    const next2 = recentSignals[i + 2];
    
    // Check if this point is a peak (higher than surrounding points)
    if (current.value > prev1.value && 
        current.value > prev2.value &&
        current.value > next1.value && 
        current.value > next2.value &&
        Math.abs(current.value) > peakThreshold) {
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
    
    // Check for consistency in intervals (rhythm)
    let consistentIntervals = 0;
    const maxDeviation = 200; // Allow 200ms deviation between intervals
    
    for (let i = 1; i < intervals.length; i++) {
      if (Math.abs(intervals[i] - intervals[i - 1]) < maxDeviation) {
        consistentIntervals++;
      }
    }
    
    // If we have consistent intervals, increment the pattern counter
    let updatedPatternCount = previousPatternCount;
    
    if (consistentIntervals >= MIN_PEAKS_FOR_PATTERN - 1) {
      updatedPatternCount++;
    } else {
      // Reduce the counter if pattern is not consistent
      updatedPatternCount = Math.max(0, updatedPatternCount - 1);
    }
    
    return {
      isFingerDetected: updatedPatternCount >= REQUIRED_PATTERNS,
      patternCount: updatedPatternCount,
      peakTimes: peaks
    };
  }
  
  return {
    isFingerDetected: previousPatternCount >= REQUIRED_PATTERNS,
    patternCount: previousPatternCount,
    peakTimes: []
  };
};

/**
 * Reset detection states for signal quality detection
 * Used to reset any accumulating detection states
 * No simulation or calibration data used
 */
export const resetDetectionStates = (): void => {
  // Reset any internal state if needed
  // This is a placeholder function to satisfy the import
  console.log("Signal quality detection states reset - direct measurement only");
};

/**
 * Check if a point is in an arrhythmia window
 * Used by PPGSignalMeter for visualization
 * Works only with real detected arrhythmias
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
 * Increased threshold to reduce false positives
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Higher threshold to avoid processing weak signals (likely noise)
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

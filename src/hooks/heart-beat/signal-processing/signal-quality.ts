
/**
 * Module for signal quality assessment and finger detection
 */

export interface SignalQualityOptions {
  lowSignalThreshold: number;
  maxWeakSignalCount: number;
}

const DEFAULT_OPTIONS: SignalQualityOptions = {
  lowSignalThreshold: 0.15,
  maxWeakSignalCount: 4
};

/**
 * Check if a signal is weak based on its value
 * @param value Current signal value
 * @param currentWeakSignalsCount Current count of consecutive weak signals
 * @param options Configuration options
 * @returns Status of signal quality check
 */
export const checkWeakSignal = (
  value: number,
  currentWeakSignalsCount: number,
  options: Partial<SignalQualityOptions> = {}
): { isWeakSignal: boolean; updatedWeakSignalsCount: number } => {
  // Combine with default options
  const { lowSignalThreshold, maxWeakSignalCount } = {
    ...DEFAULT_OPTIONS,
    ...options
  };

  // Check if the current signal is weak based on amplitude
  const isCurrentSignalWeak = Math.abs(value) < lowSignalThreshold;
  
  // Update the counter for consecutive weak signals
  let updatedWeakSignalsCount = currentWeakSignalsCount;
  
  if (isCurrentSignalWeak) {
    // Increment counter if the current signal is weak
    updatedWeakSignalsCount = Math.min(maxWeakSignalCount + 2, currentWeakSignalsCount + 1);
  } else {
    // Gradually decrease counter if the signal is strong
    updatedWeakSignalsCount = Math.max(0, currentWeakSignalsCount - 0.5);
  }
  
  // Signal is considered weak if we've accumulated enough consecutive weak signals
  const isWeakSignal = updatedWeakSignalsCount >= maxWeakSignalCount;
  
  if (updatedWeakSignalsCount === maxWeakSignalCount && isWeakSignal) {
    console.log('Weak signal detected, may indicate finger removed or poorly positioned');
  }
  
  return { isWeakSignal, updatedWeakSignalsCount };
};

/**
 * Determine if we should process the measurement based on signal quality
 * @param signalQuality Signal quality (0-100)
 * @param isFingerDetected Indication if finger is detected
 * @param weakSignalsCount Count of consecutive weak signals
 * @returns True if we should process the measurement
 */
export const shouldProcessMeasurement = (
  signalQuality: number = 0,
  isFingerDetected: boolean = true,
  weakSignalsCount: number = 0
): boolean => {
  // Requirements to process:
  // 1. Finger must be detected
  // 2. Signal quality must be acceptable (>30)
  // 3. Not too many consecutive weak signals
  return (
    isFingerDetected &&
    signalQuality > 30 &&
    weakSignalsCount < DEFAULT_OPTIONS.maxWeakSignalCount
  );
};

/**
 * Simple version for checking if we should process a measurement
 * when only value is available and not additional quality metrics
 */
export const shouldProcessMeasurement = (
  value: number
): boolean => {
  // Simple amplitude check
  return Math.abs(value) > DEFAULT_OPTIONS.lowSignalThreshold * 2;
};

/**
 * Create a weak signal result (all values at zero/default)
 * @returns Object with default result values
 */
export const createWeakSignalResult = (arrhythmiaCount: number = 0) => {
  return {
    bpm: 0,
    confidence: 0,
    isPeak: false,
    isArrhythmia: false,
    arrhythmiaCount: arrhythmiaCount,
    rrData: {
      intervals: [],
      lastPeakTime: null
    }
  };
};

/**
 * Reset the signal quality state
 * @returns Object with initial signal quality state values
 */
export const resetSignalQualityState = () => {
  return {
    weakSignalsCount: 0,
    signalQuality: 0,
    isFingerDetected: false
  };
};

/**
 * Reset detection states
 * This function is required by HeartBeatProcessor.js
 */
export const resetDetectionStates = () => {
  console.log("Signal quality: Resetting detection states");
  return resetSignalQualityState();
};

/**
 * Detect if a finger is present based on signal pattern
 * @param signalHistory History of signals with time and values
 * @param currentPatternCount Current count of detected patterns
 * @returns Object with detection result and updated pattern count
 */
export const isFingerDetected = (
  signalQuality: number,
  hasFingerPattern: boolean,
  weakSignalsCount: number
): boolean => {
  return signalQuality > 40 && hasFingerPattern && weakSignalsCount < DEFAULT_OPTIONS.maxWeakSignalCount;
};

/**
 * Detect if finger is present based on rhythmic patterns
 * @param signalHistory Signal history with time and value
 * @param currentPatternCount Current count of detected patterns
 * @returns Object with detection result and updated count
 */
export const isFingerDetectedByPattern = (
  signalHistory: Array<{time: number, value: number}>, 
  currentPatternCount: number
): { isFingerDetected: boolean; patternCount: number } => {
  // Basic rhythm detection implementation
  if (signalHistory.length < 10) {
    return { isFingerDetected: false, patternCount: 0 };
  }
  
  // Check for a rhythmic pattern in the data
  let patternDetected = false;
  let updatedPatternCount = currentPatternCount;
  
  // Analyze zero crossings and regularity to detect cardiac pattern
  const crossings = findZeroCrossings(signalHistory);
  
  if (crossings.length >= 3) {
    const intervals = calculateIntervals(crossings);
    
    // Check regularity of intervals (characteristic of physiological signal)
    const isRegular = checkRegularity(intervals);
    
    if (isRegular) {
      patternDetected = true;
      updatedPatternCount = Math.min(10, currentPatternCount + 1);
    } else {
      updatedPatternCount = Math.max(0, currentPatternCount - 1);
    }
  } else {
    // Gradually reduce counter if not enough crossings
    updatedPatternCount = Math.max(0, currentPatternCount - 0.5);
  }
  
  // Finger is considered present if we've detected patterns repeatedly
  const isFingerDetected = updatedPatternCount >= 3;
  
  return { isFingerDetected, patternCount: updatedPatternCount };
};

// Helper functions for pattern detection

function findZeroCrossings(signalHistory: Array<{time: number, value: number}>): number[] {
  const crossings: number[] = [];
  
  for (let i = 1; i < signalHistory.length; i++) {
    if ((signalHistory[i-1].value < 0 && signalHistory[i].value >= 0) ||
        (signalHistory[i-1].value >= 0 && signalHistory[i].value < 0)) {
      crossings.push(signalHistory[i].time);
    }
  }
  
  return crossings;
}

function calculateIntervals(crossings: number[]): number[] {
  const intervals: number[] = [];
  
  for (let i = 1; i < crossings.length; i++) {
    intervals.push(crossings[i] - crossings[i-1]);
  }
  
  return intervals;
}

function checkRegularity(intervals: number[]): boolean {
  if (intervals.length < 2) return false;
  
  // Calculate standard deviation of intervals
  const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  
  // Coefficient of variation (normalized by mean)
  const cv = stdDev / mean;
  
  // Low CV indicates regularity (characteristic of cardiac signal)
  return cv < 0.5;
}

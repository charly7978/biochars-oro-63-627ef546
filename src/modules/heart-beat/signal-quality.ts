
/**
 * Signal quality utility functions for heart beat signals
 * DIRECT MEASUREMENT ONLY - NO SIMULATION OR MANIPULATION
 */

// Signal quality thresholds with increased values to reduce false positives
const GOOD_QUALITY_THRESHOLD = 70; // Increased from 65
const ACCEPTABLE_QUALITY_THRESHOLD = 45; // Increased from 40
const MIN_SIGNAL_STRENGTH = 0.15; // Higher threshold for signal detection

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

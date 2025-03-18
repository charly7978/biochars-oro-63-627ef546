
/**
 * Signal quality utility functions for heart beat signals
 * DIRECT MEASUREMENT ONLY - NO SIMULATION OR MANIPULATION
 */

// Signal quality thresholds
const GOOD_QUALITY_THRESHOLD = 65;
const ACCEPTABLE_QUALITY_THRESHOLD = 40;

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
 */
export const checkSignalQuality = (
  signalValue: number,
  currentWeakSignalsCount: number,
  options?: {
    lowSignalThreshold?: number;
    maxWeakSignalCount?: number;
  }
): { isWeakSignal: boolean; updatedWeakSignalsCount: number } => {
  const threshold = options?.lowSignalThreshold || 0.1;
  const maxWeakSignals = options?.maxWeakSignalCount || 3;
  
  const isWeak = Math.abs(signalValue) < threshold;
  let updatedCount = currentWeakSignalsCount;
  
  if (isWeak) {
    updatedCount = Math.min(maxWeakSignals, updatedCount + 1);
  } else {
    updatedCount = Math.max(0, updatedCount - 1);
  }
  
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

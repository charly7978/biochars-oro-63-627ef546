
/**
 * Functions for assessing PPG signal quality
 */

/**
 * Checks if signal quality is low (potentially finger removed)
 */
export function checkSignalQuality(
  amplitude: number,
  weakSignalsCount: number,
  config: {
    lowSignalThreshold: number,
    maxWeakSignalCount: number
  }
): {
  isWeakSignal: boolean,
  updatedWeakSignalsCount: number
} {
  let updatedCount = weakSignalsCount;
  
  if (Math.abs(amplitude) < config.lowSignalThreshold) {
    updatedCount++;
  } else {
    updatedCount = 0;
  }
  
  return {
    isWeakSignal: updatedCount > config.maxWeakSignalCount,
    updatedWeakSignalsCount: updatedCount
  };
}

/**
 * Calculate a weighted quality score from recent quality values
 * @param qualityHistory Array of recent quality measurements
 * @returns Weighted average quality score
 */
export function calculateWeightedQuality(qualityHistory: number[]): number {
  if (qualityHistory.length === 0) return 0;
  
  let weightedSum = 0;
  let weightSum = 0;
  
  qualityHistory.forEach((q, index) => {
    // More recent values have higher weight
    const weight = index + 1;
    weightedSum += q * weight;
    weightSum += weight;
  });
  
  return weightSum > 0 ? weightedSum / weightSum : 0;
}

/**
 * Get appropriate color for signal quality display
 * @param quality Quality value (0-100)
 * @param isFingerDetected Whether finger is detected
 * @returns CSS color class or value
 */
export function getQualityColor(quality: number, isFingerDetected: boolean): string {
  if (!isFingerDetected) return 'from-gray-400 to-gray-500';
  if (quality > 65) return 'from-green-500 to-emerald-500';
  if (quality > 40) return 'from-yellow-500 to-orange-500';
  return 'from-red-500 to-rose-500';
}

/**
 * Get descriptive text for signal quality
 * @param quality Quality value (0-100)
 * @param isFingerDetected Whether finger is detected
 * @returns Human readable quality description
 */
export function getQualityText(quality: number, isFingerDetected: boolean): string {
  if (!isFingerDetected) return 'Sin detección';
  if (quality > 65) return 'Señal óptima';
  if (quality > 40) return 'Señal aceptable';
  return 'Señal débil';
}

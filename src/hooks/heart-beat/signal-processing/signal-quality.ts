
/**
 * Signal quality utilities for heart beat analysis
 * Only processes real data, no simulation
 */

export interface WeakSignalParams {
  lowSignalThreshold: number;
  maxWeakSignalCount: number;
}

export const checkWeakSignal = (
  value: number,
  consecutiveWeakSignals: number,
  params: WeakSignalParams
): { isWeakSignal: boolean; updatedWeakSignalsCount: number } => {
  const { lowSignalThreshold, maxWeakSignalCount } = params;
  
  // Check for weak signal in real data
  const isCurrentValueWeak = Math.abs(value) < lowSignalThreshold;
  
  let updatedWeakSignalsCount = consecutiveWeakSignals;
  
  if (isCurrentValueWeak) {
    updatedWeakSignalsCount++;
  } else {
    updatedWeakSignalsCount = Math.max(0, updatedWeakSignalsCount - 1);
  }
  
  const isWeakSignal = updatedWeakSignalsCount >= maxWeakSignalCount;
  
  return { isWeakSignal, updatedWeakSignalsCount };
};

export const shouldProcessMeasurement = (value: number): boolean => {
  // Verify the value is a reasonable magnitude for PPG data
  return Math.abs(value) >= 0.01 && Math.abs(value) <= 100;
};

export const checkSignalQuality = (
  value: number,
  weakSignalsCount: number,
  params: WeakSignalParams
): { isWeakSignal: boolean; updatedWeakSignalsCount: number } => {
  return checkWeakSignal(value, weakSignalsCount, params);
};

export const calculateWeightedQuality = (qualityHistory: number[]): number => {
  if (qualityHistory.length === 0) return 0;
  
  let weightedSum = 0;
  let weightSum = 0;
  
  // Apply more weight to recent quality measurements
  qualityHistory.forEach((quality, index) => {
    const weight = index + 1; // More recent values get higher weight
    weightedSum += quality * weight;
    weightSum += weight;
  });
  
  return weightSum > 0 ? weightedSum / weightSum : 0;
};

export const getQualityColor = (quality: number): string => {
  if (quality >= 70) return '#22c55e'; // Green for good quality
  if (quality >= 40) return '#f59e0b'; // Yellow/orange for medium quality
  return '#ef4444'; // Red for poor quality
};

export const getQualityText = (quality: number): string => {
  if (quality >= 70) return 'Óptima';
  if (quality >= 40) return 'Aceptable';
  return 'Débil';
};

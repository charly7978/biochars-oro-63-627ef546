
/**
 * Re-export utilities from the central file to avoid duplication
 * and maintain a single source of truth for these functions.
 */
export {
  calculateAC,
  calculateDC,
  calculateStandardDeviation,
  findPeaksAndValleys,
  calculateAmplitude,
  applySMAFilter
} from '../../utils/vitalSignsUtils';

/**
 * Module-specific functions for vital signs that aren't shared
 * with other components can go here
 */

/**
 * Calculate Exponential Moving Average (EMA) to smooth signals
 * @param prevEMA Previous EMA
 * @param currentValue Current value
 * @param alpha Smoothing factor (0-1)
 */
export function calculateEMA(prevEMA: number, currentValue: number, alpha: number): number {
  return alpha * currentValue + (1 - alpha) * prevEMA;
}

/**
 * Normalize a value within a specific range
 */
export function normalizeValue(value: number, min: number, max: number): number {
  return (value - min) / (max - min);
}

/**
 * Calculate perfusion index based on AC and DC components
 */
export function calculatePerfusionIndex(ac: number, dc: number): number {
  if (dc === 0) return 0;
  return ac / dc;
}

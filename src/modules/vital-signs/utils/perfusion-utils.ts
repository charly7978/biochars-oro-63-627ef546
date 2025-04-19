
/**
 * Utility functions for calculating perfusion indexes from PPG signals
 */

/**
 * Calculates the perfusion index from a PPG signal
 * @param signal Input PPG signal array
 * @returns Perfusion index value
 */
export const calculatePerfusionIndex = (signal: number[]): number => {
  if (!signal || signal.length < 2) return 0;
  
  // Find min and max values in signal window
  let min = signal[0];
  let max = signal[0];
  
  for (let i = 1; i < signal.length; i++) {
    if (signal[i] < min) min = signal[i];
    if (signal[i] > max) max = signal[i];
  }
  
  // Calculate perfusion index as AC/DC ratio * 100
  // AC is peak-to-peak amplitude
  // DC is the average baseline
  const ac = max - min;
  const dc = signal.reduce((sum, val) => sum + val, 0) / signal.length;
  
  // Avoid division by zero
  if (dc === 0) return 0;
  
  // Perfusion index as percentage
  return (ac / dc) * 100;
};

/**
 * Normalizes the perfusion value to a scale from 0 to 100
 * @param perfusionValue Raw perfusion value
 * @param minExpected Minimum expected perfusion
 * @param maxExpected Maximum expected perfusion
 * @returns Normalized perfusion value (0-100)
 */
export const normalizePerfusion = (
  perfusionValue: number,
  minExpected: number = 0.1,
  maxExpected: number = 20
): number => {
  if (perfusionValue <= minExpected) return 0;
  if (perfusionValue >= maxExpected) return 100;
  
  // Linear normalization
  return ((perfusionValue - minExpected) / (maxExpected - minExpected)) * 100;
};

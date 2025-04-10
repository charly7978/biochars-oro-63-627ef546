
/**
 * Interface for signal quality check options
 */
export interface SignalQualityOptions {
  lowSignalThreshold: number;
  maxWeakSignalCount: number;
}

/**
 * Interface for signal quality check results
 */
export interface SignalQualityResult {
  isWeakSignal: boolean;
  updatedWeakSignalsCount: number;
}

/**
 * Centralized function to check signal quality
 * Used across different modules for consistent finger detection
 */
export function checkSignalQuality(
  value: number,
  currentWeakSignals: number,
  options: SignalQualityOptions
): SignalQualityResult {
  const { lowSignalThreshold, maxWeakSignalCount } = options;
  
  // Check if the signal is weak (near zero)
  const isCurrentValueWeak = Math.abs(value) < lowSignalThreshold;
  
  // Update weak signals counter
  let updatedWeakSignalsCount = isCurrentValueWeak 
    ? currentWeakSignals + 1 
    : Math.max(0, currentWeakSignals - 1);
  
  // Determine if we've had too many consecutive weak signals
  const isWeakSignal = updatedWeakSignalsCount >= maxWeakSignalCount;
  
  return { isWeakSignal, updatedWeakSignalsCount };
}

/**
 * Check if a finger is detected using pattern recognition
 */
export function isFingerDetectedByPattern(
  values: number[],
  minQuality: number = 40,
  minSamples: number = 20
): boolean {
  if (values.length < minSamples) {
    return false;
  }
  
  // Calculate signal quality
  const recentValues = values.slice(-minSamples);
  const min = Math.min(...recentValues);
  const max = Math.max(...recentValues);
  const range = max - min;
  
  if (range < 0.01) {
    return false;
  }
  
  // Check for rhythmic patterns (simplified)
  const crossings = countZeroCrossings(normalizeSignal(recentValues));
  const hasPulsatilePattern = crossings >= 2 && crossings <= 8;
  
  // Calculate signal quality
  const quality = calculateSignalQuality(recentValues);
  
  return quality >= minQuality && hasPulsatilePattern;
}

/**
 * Count zero crossings in a signal
 */
function countZeroCrossings(signal: number[]): number {
  let crossings = 0;
  for (let i = 1; i < signal.length; i++) {
    if ((signal[i] >= 0 && signal[i-1] < 0) || (signal[i] < 0 && signal[i-1] >= 0)) {
      crossings++;
    }
  }
  return crossings;
}

/**
 * Normalize a signal to have zero mean
 */
function normalizeSignal(signal: number[]): number[] {
  const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
  return signal.map(val => val - mean);
}

/**
 * Calculate signal quality
 */
function calculateSignalQuality(values: number[]): number {
  if (values.length < 3) {
    return 0;
  }
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  
  if (range < 0.01) {
    return 0;
  }
  
  // Calculate noise level
  let noise = 0;
  for (let i = 2; i < values.length; i++) {
    const diff = Math.abs(values[i] - 2 * values[i-1] + values[i-2]);
    noise += diff;
  }
  noise /= (values.length - 2);
  
  // Calculate SNR and convert to quality metric
  const snr = range / Math.max(0.001, noise);
  return Math.min(100, Math.max(0, snr * 50));
}

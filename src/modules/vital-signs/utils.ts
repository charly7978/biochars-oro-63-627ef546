
/**
 * Utility functions for vital signs processing
 */

/**
 * Calculates the AC component of a PPG signal
 */
export function calculateAC(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

/**
 * Calculates the DC component of a PPG signal
 */
export function calculateDC(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calculates the amplitude of a PPG signal
 */
export function calculateAmplitude(
  values: number[],
  peaks: number[],
  valleys: number[]
): number {
  if (peaks.length === 0 || valleys.length === 0) return 0;

  const amps: number[] = [];
  
  // Find matching peaks and valleys
  for (let i = 0; i < peaks.length; i++) {
    // Find the nearest valley after this peak
    let nearestValleyIndex = -1;
    let minDistance = Number.MAX_VALUE;
    
    for (let j = 0; j < valleys.length; j++) {
      const distance = Math.abs(valleys[j] - peaks[i]);
      if (distance < minDistance && valleys[j] > peaks[i]) {
        minDistance = distance;
        nearestValleyIndex = j;
      }
    }
    
    if (nearestValleyIndex >= 0) {
      const amp = values[peaks[i]] - values[valleys[nearestValleyIndex]];
      if (amp > 0) {
        amps.push(amp);
      }
    }
  }
  
  if (amps.length === 0) return 0;

  // Return mean amplitude
  return amps.reduce((a, b) => a + b, 0) / amps.length;
}

/**
 * Finds peaks and valleys in a PPG signal
 */
export function findPeaksAndValleys(values: number[]): {
  peakIndices: number[];
  valleyIndices: number[];
} {
  const peakIndices: number[] = [];
  const valleyIndices: number[] = [];
  
  // Simplified peak/valley detection using local maxima/minima
  for (let i = 2; i < values.length - 2; i++) {
    const v = values[i];
    
    // Check if this point is a peak
    if (v > values[i - 1] && v > values[i - 2] && 
        v > values[i + 1] && v > values[i + 2]) {
      peakIndices.push(i);
    }
    
    // Check if this point is a valley
    if (v < values[i - 1] && v < values[i - 2] && 
        v < values[i + 1] && v < values[i + 2]) {
      valleyIndices.push(i);
    }
  }
  
  return { peakIndices, valleyIndices };
}

/**
 * Create a simple moving average filter
 */
export function applySMAFilter(values: number[], windowSize: number = 3): number[] {
  if (!values || values.length === 0) return [];
  if (values.length <= windowSize) return [...values];
  
  const result: number[] = [];
  
  // Initialize first values without full window
  for (let i = 0; i < windowSize - 1; i++) {
    let sum = 0;
    for (let j = 0; j <= i; j++) {
      sum += values[j];
    }
    result.push(sum / (i + 1));
  }
  
  // Apply SMA with full window
  for (let i = windowSize - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      sum += values[i - j];
    }
    result.push(sum / windowSize);
  }
  
  return result;
}

/**
 * Calculate the RMS value of a signal
 */
export function calculateRMS(values: number[]): number {
  if (values.length === 0) return 0;
  
  const sumOfSquares = values.reduce((sum, val) => sum + val * val, 0);
  return Math.sqrt(sumOfSquares / values.length);
}

/**
 * Calculate the standard deviation of a signal
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length <= 1) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  
  return Math.sqrt(variance);
}

/**
 * Detect outliers using IQR method
 */
export function removeOutliers(values: number[], factor: number = 1.5): number[] {
  if (values.length < 4) return [...values];
  
  const sorted = [...values].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length / 4);
  const q3Index = Math.floor(3 * sorted.length / 4);
  
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  
  const lowerBound = q1 - factor * iqr;
  const upperBound = q3 + factor * iqr;
  
  return values.filter(val => val >= lowerBound && val <= upperBound);
}

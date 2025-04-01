
/**
 * Signal processing utilities for vital signs
 */

/**
 * Calculate AC component of a signal (variations)
 * @param values Array of values
 */
export function calculateAC(values: number[]): number {
  if (values.length < 2) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
}

/**
 * Calculate DC component of a signal (baseline)
 * @param values Array of values
 */
export function calculateDC(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Normalize signal values to range 0-1
 * @param values Array of values
 */
export function normalizeValue(values: number[]): number[] {
  if (values.length === 0) return [];
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  
  if (max === min) return values.map(() => 0.5);
  
  return values.map(val => (val - min) / (max - min));
}

/**
 * Apply Simple Moving Average filter
 * @param values Array of values
 * @param windowSize Window size for the filter
 */
export function applySMAFilter(values: number[], windowSize: number = 5): number[] {
  if (values.length <= 1 || windowSize <= 1) return [...values];
  
  const result: number[] = [];
  const actualWindowSize = Math.min(windowSize, values.length);
  
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let count = 0;
    
    for (let j = Math.max(0, i - Math.floor(actualWindowSize / 2)); 
         j <= Math.min(values.length - 1, i + Math.floor(actualWindowSize / 2)); 
         j++) {
      sum += values[j];
      count++;
    }
    
    result.push(sum / count);
  }
  
  return result;
}

/**
 * Find peaks and valleys in signal
 * @param values Array of values
 * @param threshold Minimum amplitude threshold
 */
export function findPeaksAndValleys(values: number[], threshold: number = 0.1): { peaks: number[], valleys: number[] } {
  const peaks: number[] = [];
  const valleys: number[] = [];
  
  if (values.length < 3) return { peaks, valleys };
  
  for (let i = 1; i < values.length - 1; i++) {
    // Check for peak
    if (values[i] > values[i-1] && values[i] > values[i+1]) {
      // Calculate height from nearest valley
      let leftValleyIdx = i - 1;
      while (leftValleyIdx > 0 && values[leftValleyIdx] >= values[leftValleyIdx-1]) {
        leftValleyIdx--;
      }
      
      let rightValleyIdx = i + 1;
      while (rightValleyIdx < values.length - 1 && values[rightValleyIdx] >= values[rightValleyIdx+1]) {
        rightValleyIdx++;
      }
      
      const leftHeight = values[i] - values[leftValleyIdx];
      const rightHeight = values[i] - values[rightValleyIdx];
      const minHeight = Math.min(leftHeight, rightHeight);
      
      if (minHeight >= threshold) {
        peaks.push(i);
      }
    }
    
    // Check for valley
    if (values[i] < values[i-1] && values[i] < values[i+1]) {
      // Calculate depth from nearest peak
      let leftPeakIdx = i - 1;
      while (leftPeakIdx > 0 && values[leftPeakIdx] <= values[leftPeakIdx-1]) {
        leftPeakIdx--;
      }
      
      let rightPeakIdx = i + 1;
      while (rightPeakIdx < values.length - 1 && values[rightPeakIdx] <= values[rightPeakIdx+1]) {
        rightPeakIdx++;
      }
      
      const leftDepth = values[leftPeakIdx] - values[i];
      const rightDepth = values[rightPeakIdx] - values[i];
      const minDepth = Math.min(leftDepth, rightDepth);
      
      if (minDepth >= threshold) {
        valleys.push(i);
      }
    }
  }
  
  return { peaks, valleys };
}

/**
 * Calculate amplitude of a signal
 * @param values Array of values
 */
export function calculateAmplitude(values: number[]): number {
  if (values.length === 0) return 0;
  
  const max = Math.max(...values);
  const min = Math.min(...values);
  
  return max - min;
}

/**
 * Amplify signal by a factor
 * @param values Array of values
 * @param factor Amplification factor
 */
export function amplifySignal(values: number[], factor: number = 2): number[] {
  if (factor <= 0) return [...values];
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  return values.map(val => mean + (val - mean) * factor);
}

/**
 * Calculate perfusion index
 * @param values Array of values
 */
export function calculatePerfusionIndex(values: number[]): number {
  if (values.length < 2) return 0;
  
  const ac = calculateAC(values);
  const dc = calculateDC(values);
  
  if (dc === 0) return 0;
  
  return (ac / dc) * 100;
}

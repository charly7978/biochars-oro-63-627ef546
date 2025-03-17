
/**
 * Signal filtering utilities for PPG signal processing
 * Extracted from SignalProcessor for better maintainability
 */

/**
 * Apply Simple Moving Average filter to a value
 */
export function applySMAFilter(value: number, values: number[], windowSize: number): number {
  if (values.length < windowSize) {
    return value;
  }
  
  const recentValues = values.slice(-windowSize);
  const sum = recentValues.reduce((acc, val) => acc + val, 0);
  return (sum + value) / (windowSize + 1);
}

/**
 * Apply Exponential Moving Average filter
 */
export function applyEMAFilter(value: number, lastValue: number, alpha: number): number {
  return alpha * value + (1 - alpha) * lastValue;
}

/**
 * Apply median filter to remove outliers and impulse noise
 */
export function applyMedianFilter(value: number, values: number[], windowSize: number): number {
  if (values.length < windowSize) {
    return value;
  }
  
  const valuesToSort = [...values.slice(-windowSize), value];
  valuesToSort.sort((a, b) => a - b);
  
  // Return the median value
  return valuesToSort[Math.floor(valuesToSort.length / 2)];
}

/**
 * Detect and reject outliers based on statistical analysis
 */
export function detectOutlier(value: number, recentValues: number[]): boolean {
  if (recentValues.length < 5) {
    return false;
  }
  
  const values = recentValues.slice(-5);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const stdDev = Math.sqrt(
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  );
  
  // Reject values that are more than 3 standard deviations from the mean
  return Math.abs(value - mean) > (stdDev * 3);
}

/**
 * Apply combined filtering for robust signal processing
 * Uses multiple filters in sequence for better results
 */
export function applyFilters(
  value: number, 
  values: number[], 
  noiseLevel: number,
  SMA_WINDOW_SIZE: number,
  MEDIAN_WINDOW_SIZE: number,
  LOW_PASS_ALPHA: number
): { 
  filteredValue: number; 
  quality: number;
  updatedNoiseLevel: number;
} {
  // Step 1: Apply outlier rejection
  const isOutlier = detectOutlier(value, values);
  const cleanValue = isOutlier ? 
    (values.length > 0 ? values[values.length - 1] : value) : 
    value;
  
  // Step 2: Median filter to remove remaining outliers
  const medianFiltered = applyMedianFilter(cleanValue, values, MEDIAN_WINDOW_SIZE);
  
  // Step 3: Low pass filter to smooth the signal
  const lastValue = values.length > 0 ? values[values.length - 1] : medianFiltered;
  const lowPassFiltered = applyEMAFilter(medianFiltered, lastValue, LOW_PASS_ALPHA);
  
  // Step 4: Moving average for final smoothing
  const smaFiltered = applySMAFilter(lowPassFiltered, values, SMA_WINDOW_SIZE);
  
  // Calculate noise level - higher values indicate more noise
  const instantNoise = Math.abs(value - smaFiltered);
  const updatedNoiseLevel = 0.1 * instantNoise + 0.9 * noiseLevel;
  
  // Calculate signal quality (0-100) with enhanced criteria
  const quality = calculateSignalQuality(values, updatedNoiseLevel);
  
  return { 
    filteredValue: smaFiltered,
    quality,
    updatedNoiseLevel
  };
}

/**
 * Calculate signal quality based on multiple criteria
 * Returns 0-100 quality score
 */
function calculateSignalQuality(values: number[], noiseLevel: number): number {
  // No quality assessment with insufficient data
  if (values.length < 15) {
    return 30; // Lower default quality
  }
  
  // Factor 1: Noise level (lower is better)
  const noiseScore = Math.max(0, 100 - (noiseLevel * 5));
  
  // Factor 2: Signal stability
  const recentValues = values.slice(-15);
  const sum = recentValues.reduce((a, b) => a + b, 0);
  const mean = sum / recentValues.length;
  const variance = recentValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentValues.length;
  const stabilityScore = Math.max(0, 100 - Math.min(100, variance / 1.5));
  
  // Factor 3: Signal range (look for cardiac-like amplitude)
  const min = Math.min(...recentValues);
  const max = Math.max(...recentValues);
  const range = max - min;
  
  let rangeScore = 0;
  const MIN_REQUIRED_AMPLITUDE = 10;
  const MAX_ALLOWED_AMPLITUDE = 120;
  
  if (range >= MIN_REQUIRED_AMPLITUDE && range <= MAX_ALLOWED_AMPLITUDE) {
    // Optimal range
    rangeScore = 100;
  } else if (range < MIN_REQUIRED_AMPLITUDE) {
    // Too small - likely no finger
    rangeScore = Math.max(0, (range / MIN_REQUIRED_AMPLITUDE) * 80);
  } else {
    // Too large - likely motion artifact
    rangeScore = Math.max(0, 100 - ((range - MAX_ALLOWED_AMPLITUDE) / 20));
  }
  
  // Factor 4: Pattern consistency
  const patternScore = evaluatePatternConsistency(recentValues);
  
  // Weighted average of factors with updated weights
  const quality = Math.round(
    (noiseScore * 0.25) +
    (stabilityScore * 0.3) +
    (rangeScore * 0.25) +
    (patternScore * 0.2)
  );
  
  return Math.min(100, Math.max(0, quality));
}

/**
 * Evaluate pattern consistency
 * Real PPG signals have consistent periodic patterns
 */
function evaluatePatternConsistency(values: number[]): number {
  if (values.length < 10) {
    return 50;
  }
  
  // Find peaks to analyze pattern
  const peaks = findPeaksEnhanced(values);
  
  if (peaks.length < 2) {
    return 30; // Penalize if we can't find clear peaks
  }
  
  // Calculate intervals between peaks
  const intervals = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i-1]);
  }
  
  // Calculate interval consistency
  const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const intervalVariation = intervals.reduce((sum, val) => sum + Math.abs(val - avgInterval), 0) / intervals.length;
  const consistencyRatio = intervalVariation / avgInterval;
  
  // Lower ratio = more consistent
  const consistencyScore = Math.max(0, 100 - (consistencyRatio * 100));
  
  // Check for physiologically reasonable rate
  // Assumes 30 samples/sec and intervals should be between 0.5 and 2 seconds
  // (for heart rates between 30 and 120 bpm)
  const isPhysiological = avgInterval >= 15 && avgInterval <= 60;
  
  return isPhysiological ? consistencyScore : Math.min(60, consistencyScore);
}

/**
 * Enhanced peak detection helper used for pattern consistency
 */
function findPeaksEnhanced(values: number[]): number[] {
  const peaks: number[] = [];
  const minPeakDistance = 12;
  
  // Calculate mean and standard deviation
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const stdDev = Math.sqrt(
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  );
  
  // Dynamic threshold based on signal statistics
  const peakThreshold = mean + (stdDev * 0.7);
  
  // First pass: find potential peaks
  const potentialPeaks = [];
  for (let i = 3; i < values.length - 3; i++) {
    const current = values[i];
    
    if (current > values[i - 1] && 
        current > values[i - 2] &&
        current > values[i - 3] &&
        current > values[i + 1] && 
        current > values[i + 2] &&
        current > values[i + 3] &&
        current > peakThreshold) {
      
      potentialPeaks.push(i);
    }
  }
  
  // Second pass: filter peaks by prominence and distance
  for (let i = 0; i < potentialPeaks.length; i++) {
    const peakIdx = potentialPeaks[i];
    const peakValue = values[peakIdx];
    
    // Find nearest valleys to calculate prominence
    let leftValley = mean;
    for (let j = peakIdx - 1; j >= 0; j--) {
      if (values[j] <= values[j + 1]) {
        leftValley = values[j];
        break;
      }
    }
    
    let rightValley = mean;
    for (let j = peakIdx + 1; j < values.length; j++) {
      if (values[j] <= values[j - 1]) {
        rightValley = values[j];
        break;
      }
    }
    
    // Calculate prominence (minimum height above surrounding valleys)
    const prominence = Math.min(peakValue - leftValley, peakValue - rightValley);
    
    // Only accept peaks with sufficient prominence
    if (prominence > stdDev * 0.5) {
      // Check distance from other accepted peaks
      const isFarEnough = peaks.every(p => Math.abs(peakIdx - p) >= minPeakDistance);
      
      if (isFarEnough) {
        peaks.push(peakIdx);
      }
    }
  }
  
  return peaks.sort((a, b) => a - b);
}

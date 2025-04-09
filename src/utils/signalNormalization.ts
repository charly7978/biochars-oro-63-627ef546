
/**
 * Utilities for robust signal normalization and filtering
 * Provides multiple normalization strategies and adaptive filtering
 */

/**
 * Options for signal normalization
 */
export interface NormalizationOptions {
  method: 'z-score' | 'min-max' | 'robust-z-score' | 'adaptive';
  windowSize?: number;
  clipOutliers?: boolean;
  clipThreshold?: number;
  minValue?: number;
  maxValue?: number;
}

/**
 * Default normalization options
 */
export const DEFAULT_NORMALIZATION_OPTIONS: NormalizationOptions = {
  method: 'robust-z-score',
  windowSize: 20,
  clipOutliers: true,
  clipThreshold: 3.0,
  minValue: -3,
  maxValue: 3
};

/**
 * Normalize a signal value using various methods
 * @param value Current signal value to normalize
 * @param buffer Recent signal history
 * @param options Normalization options
 * @returns Normalized value
 */
export function normalizeSignalValue(
  value: number,
  buffer: number[],
  options: NormalizationOptions = DEFAULT_NORMALIZATION_OPTIONS
): number {
  try {
    // Return raw value if insufficient buffer
    const windowSize = Math.min(options.windowSize || 5, buffer.length);
    if (windowSize === 0) return value;
    
    // Get window of recent values
    const window = buffer.slice(-windowSize);
    
    let normalizedValue: number;
    
    switch (options.method) {
      case 'z-score': {
        // Standard Z-score normalization: (x - mean) / std
        const mean = window.reduce((sum, v) => sum + v, 0) / window.length;
        const variance = window.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / window.length;
        const std = Math.sqrt(variance) || 1; // Avoid division by zero
        normalizedValue = (value - mean) / std;
        break;
      }
      
      case 'robust-z-score': {
        // Robust Z-score using median and MAD (Median Absolute Deviation)
        // Sort values to find median
        const sorted = [...window].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        
        // Calculate MAD: median of absolute deviations from the median
        const absoluteDeviations = sorted.map(v => Math.abs(v - median));
        absoluteDeviations.sort((a, b) => a - b);
        const mad = absoluteDeviations[Math.floor(absoluteDeviations.length / 2)] || 1;
        
        // Robust Z-score: 0.6745 is a constant for normal distribution equivalence
        normalizedValue = 0.6745 * (value - median) / mad;
        break;
      }
      
      case 'min-max': {
        // Min-Max normalization: (x - min) / (max - min)
        const min = Math.min(...window);
        const max = Math.max(...window);
        const range = max - min || 1; // Avoid division by zero
        normalizedValue = (value - min) / range;
        break;
      }
      
      case 'adaptive': {
        // Adaptive normalization that switches based on signal characteristics
        // Check if signal is stable or has outliers
        const sorted = [...window].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const iqr = sorted[Math.floor(3 * sorted.length / 4)] - sorted[Math.floor(sorted.length / 4)];
        
        // If signal has low variability (stable), use min-max
        // If signal has high variability or outliers, use robust Z-score
        if (iqr < 10) {
          // More stable signal - min-max is appropriate
          const min = Math.min(...window);
          const max = Math.max(...window);
          const range = max - min || 1; // Avoid division by zero
          normalizedValue = (value - min) / range;
        } else {
          // More variable signal - robust Z-score is better
          const absoluteDeviations = sorted.map(v => Math.abs(v - median));
          absoluteDeviations.sort((a, b) => a - b);
          const mad = absoluteDeviations[Math.floor(absoluteDeviations.length / 2)] || 1;
          normalizedValue = 0.6745 * (value - median) / mad;
        }
        break;
      }
      
      default:
        normalizedValue = value; // Fallback to raw value
    }
    
    // Clip outliers if requested
    if (options.clipOutliers && options.clipThreshold !== undefined) {
      const threshold = Math.abs(options.clipThreshold);
      normalizedValue = Math.max(-threshold, Math.min(threshold, normalizedValue));
    }
    
    // Ensure value is within specified range
    if (options.minValue !== undefined && options.maxValue !== undefined) {
      normalizedValue = Math.max(options.minValue, Math.min(options.maxValue, normalizedValue));
    }
    
    return normalizedValue;
  } catch (error) {
    console.error('Error in signal normalization:', error);
    return value; // Return original value on error
  }
}

/**
 * Multi-layered adaptive filter for PPG signals
 * @param value Current signal value to filter
 * @param buffer Recent signal history
 * @returns Filtered value
 */
export function adaptiveFilter(
  value: number,
  buffer: number[]
): number {
  try {
    if (buffer.length < 5) return value;
    
    // Recent signal window
    const window = buffer.slice(-10);
    
    // Stage 1: Moving median filter for outlier rejection
    const medianWindow = window.slice(-5);
    const sortedMedian = [...medianWindow].sort((a, b) => a - b);
    const median = sortedMedian[Math.floor(sortedMedian.length / 2)];
    
    // Stage 2: Butterworth-like low-pass filter
    // Simplified implementation with alpha based on signal dynamics
    const mean = window.reduce((sum, v) => sum + v, 0) / window.length;
    const variance = window.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / window.length;
    
    // Adaptive alpha - more smoothing for noisy signals
    const normalizedVariance = Math.min(1, variance / 100);
    const alpha = 0.2 + 0.6 * normalizedVariance; // alpha from 0.2 to 0.8
    
    // Apply low-pass filter
    const lastFiltered = buffer[buffer.length - 1];
    const filtered = alpha * value + (1 - alpha) * lastFiltered;
    
    // Stage 3: Outlier rejection - if value deviates too much from median
    const medianDifference = Math.abs(value - median);
    const medianDeviation = sortedMedian[Math.floor(3 * sortedMedian.length / 4)] -
                           sortedMedian[Math.floor(sortedMedian.length / 4)];
    
    // If value is extreme outlier, use median instead
    if (medianDifference > 3 * medianDeviation && medianDeviation > 0) {
      return median;
    }
    
    return filtered;
  } catch (error) {
    console.error('Error in adaptive filtering:', error);
    return value; // Return original value on error
  }
}

/**
 * Detect and correct baseline wander in PPG signals
 * @param buffer Signal buffer to process
 * @returns Corrected signal buffer
 */
export function correctBaselineWander(buffer: number[]): number[] {
  if (buffer.length < 10) return [...buffer];
  
  try {
    // Estimate baseline using a very wide moving average
    const windowSize = Math.min(buffer.length, 30);
    const baseline: number[] = [];
    
    for (let i = 0; i < buffer.length; i++) {
      let sum = 0;
      let count = 0;
      
      // Calculate moving average centered around current point
      for (let j = Math.max(0, i - windowSize/2); j < Math.min(buffer.length, i + windowSize/2); j++) {
        sum += buffer[j];
        count++;
      }
      
      baseline.push(sum / count);
    }
    
    // Subtract baseline from signal
    return buffer.map((value, index) => value - baseline[index]);
  } catch (error) {
    console.error('Error correcting baseline wander:', error);
    return [...buffer]; // Return original buffer on error
  }
}

/**
 * Calculate signal quality metrics
 * @param buffer Signal buffer to analyze
 * @returns Quality metrics (0-100 scale)
 */
export function calculateSignalQuality(buffer: number[]): { 
  overall: number, 
  noise: number, 
  stability: number,
  periodicity: number
} {
  if (buffer.length < 10) {
    return { 
      overall: 0, 
      noise: 0, 
      stability: 0,
      periodicity: 0
    };
  }
  
  try {
    // Get recent values for analysis
    const recentValues = buffer.slice(-20);
    
    // Calculate basic statistics
    const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    const variance = recentValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / recentValues.length;
    const stdDev = Math.sqrt(variance);
    
    // Calculate rates of change
    const changes = recentValues.slice(1).map((val, i) => Math.abs(val - recentValues[i]));
    const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
    
    // Signal-to-noise ratio estimate (higher is better)
    const snr = mean / (stdDev + 0.001);
    
    // Check for periodicity
    const periodicityScore = calculatePeriodicityScore(recentValues);
    
    // Calculate stability (lower variability in changes is more stable)
    const changeVariance = changes.reduce((acc, val) => acc + Math.pow(val - avgChange, 2), 0) / changes.length;
    const stabilityScore = Math.max(0, 100 - (changeVariance * 50));
    
    // Calculate noise level (0-100, lower is better)
    const normalizedStdDev = Math.min(1, stdDev / (mean + 0.001));
    const noiseScore = Math.min(100, normalizedStdDev * 100);
    
    // Calculate overall quality (weighted sum of components)
    const overallScore = Math.min(100, Math.max(0, 
      (stabilityScore * 0.4) + 
      ((100 - noiseScore) * 0.3) + 
      (periodicityScore * 0.3)
    ));
    
    return {
      overall: Math.round(overallScore),
      noise: Math.round(noiseScore),
      stability: Math.round(stabilityScore),
      periodicity: Math.round(periodicityScore)
    };
  } catch (error) {
    console.error('Error calculating signal quality:', error);
    return {
      overall: 0,
      noise: 0,
      stability: 0,
      periodicity: 0
    };
  }
}

/**
 * Calculate periodicity score (0-100)
 */
function calculatePeriodicityScore(values: number[]): number {
  if (values.length < 10) return 0;
  
  try {
    // Center the values around the mean
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const centered = values.map(v => v - mean);
    
    // Calculate autocorrelation for lags 1 to 10
    const correlations: number[] = [];
    for (let lag = 1; lag <= Math.floor(values.length / 2); lag++) {
      let numerator = 0;
      let denominator = 0;
      
      for (let i = 0; i < centered.length - lag; i++) {
        numerator += centered[i] * centered[i + lag];
        denominator += centered[i] * centered[i];
      }
      
      correlations.push(denominator !== 0 ? numerator / denominator : 0);
    }
    
    // Find maximum correlation and its lag
    let maxCorr = 0;
    for (const corr of correlations) {
      if (Math.abs(corr) > Math.abs(maxCorr)) {
        maxCorr = corr;
      }
    }
    
    // Convert to periodicity score (0-100)
    return Math.min(100, Math.max(0, Math.abs(maxCorr) * 100));
  } catch (error) {
    console.error('Error calculating periodicity:', error);
    return 0;
  }
}

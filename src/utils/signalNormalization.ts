
/**
 * Signal normalization and quality assessment utilities
 */

// Log levels for signal processing
export enum LogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  DEBUG = 'debug'
}

/**
 * Logs signal processing information
 */
export const logSignalProcessing = (
  level: LogLevel, 
  component: string, 
  message: string, 
  data?: any
) => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${component}]`;
  
  switch (level) {
    case LogLevel.INFO:
      console.log(`${prefix} ${message}`, data);
      break;
    case LogLevel.WARN:
      console.warn(`${prefix} ${message}`, data);
      break;
    case LogLevel.ERROR:
      console.error(`${prefix} ${message}`, data);
      break;
    case LogLevel.DEBUG:
      console.debug(`${prefix} ${message}`, data);
      break;
  }
};

/**
 * Track performance of a function
 */
export const trackPerformance = <T>(
  category: string,
  operation: string,
  fn: () => T
): T => {
  const start = performance.now();
  try {
    const result = fn();
    const duration = performance.now() - start;
    if (duration > 50) {
      logSignalProcessing(LogLevel.INFO, category, `${operation} completed in ${duration.toFixed(2)}ms`);
    }
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logSignalProcessing(LogLevel.ERROR, category, `${operation} failed after ${duration.toFixed(2)}ms`, { error });
    throw error;
  }
};

/**
 * Track performance of an async function
 */
export const trackPerformanceAsync = async <T>(
  category: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> => {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    if (duration > 50) {
      logSignalProcessing(LogLevel.INFO, category, `${operation} completed in ${duration.toFixed(2)}ms`);
    }
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logSignalProcessing(LogLevel.ERROR, category, `${operation} failed after ${duration.toFixed(2)}ms`, { error });
    throw error;
  }
};

/**
 * Normalize a signal value based on recent history
 */
export const normalizeSignalValue = (value: number, recentValues: number[]): number => {
  if (recentValues.length < 3) return value;
  
  // Get recent values for normalization
  const windowSize = Math.min(recentValues.length, 10);
  const window = recentValues.slice(-windowSize);
  
  // Calculate mean and standard deviation
  const mean = window.reduce((sum, val) => sum + val, 0) / windowSize;
  const stdDev = Math.sqrt(
    window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / windowSize
  );
  
  // Normalize value (z-score)
  return stdDev > 0 ? (value - mean) / stdDev : 0;
};

/**
 * Apply adaptive filtering to a signal value
 */
export const adaptiveFilter = (value: number, recentValues: number[]): number => {
  if (recentValues.length < 3) return value;
  
  // Apply exponential moving average with adaptive alpha
  const alpha = calculateAdaptiveAlpha(recentValues);
  
  // If this is the first value, just return it
  if (recentValues.length === 0) return value;
  
  // Apply EMA filter
  const lastValue = recentValues[recentValues.length - 1];
  return alpha * value + (1 - alpha) * lastValue;
};

/**
 * Calculate adaptive alpha for filtering based on signal characteristics
 */
const calculateAdaptiveAlpha = (values: number[]): number => {
  if (values.length < 5) return 0.3; // Default alpha
  
  // Calculate signal variability
  const recent = values.slice(-5);
  const mean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
  const variance = recent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recent.length;
  const normalizedVariance = variance / (mean * mean + 0.0001);
  
  // Adjust alpha based on variability
  // Higher variance -> lower alpha (more smoothing)
  // Lower variance -> higher alpha (less smoothing)
  if (normalizedVariance > 0.5) {
    return 0.1; // High variability, apply more smoothing
  } else if (normalizedVariance > 0.2) {
    return 0.2; // Medium variability
  } else {
    return 0.3; // Low variability, less smoothing
  }
};

/**
 * Calculate signal quality metrics
 */
export const calculateSignalQuality = (
  values: number[]
): { overall: number, noise: number, stability: number, periodicity: number } => {
  if (values.length < 10) {
    return { 
      overall: 0, 
      noise: 0, 
      stability: 0, 
      periodicity: 0 
    };
  }
  
  // Get recent values for analysis
  const window = values.slice(-30);
  
  // 1. Calculate noise level
  const noiseScore = calculateNoiseLevel(window);
  
  // 2. Calculate stability
  const stabilityScore = calculateStability(window);
  
  // 3. Calculate periodicity
  const periodicityScore = calculatePeriodicity(window);
  
  // Combine metrics into overall quality
  // Weighted average favoring the most important aspects
  const overall = Math.round(
    0.3 * noiseScore + 
    0.4 * stabilityScore + 
    0.3 * periodicityScore
  );
  
  return {
    overall,
    noise: noiseScore,
    stability: stabilityScore,
    periodicity: periodicityScore
  };
};

/**
 * Calculate noise level in signal (0-100)
 */
const calculateNoiseLevel = (values: number[]): number => {
  if (values.length < 5) return 0;
  
  // Calculate the signal amplitude
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  
  if (range < 0.001) return 0; // Too weak signal
  
  // Calculate first differences
  const diffs = [];
  for (let i = 1; i < values.length; i++) {
    diffs.push(Math.abs(values[i] - values[i-1]));
  }
  
  // Calculate average difference and normalize
  const avgDiff = diffs.reduce((sum, diff) => sum + diff, 0) / diffs.length;
  const normalizedNoise = avgDiff / range;
  
  // Convert to quality score (100 = low noise, 0 = high noise)
  return Math.max(0, Math.min(100, Math.round(100 * (1 - normalizedNoise * 5))));
};

/**
 * Calculate stability of signal (0-100)
 */
const calculateStability = (values: number[]): number => {
  if (values.length < 10) return 0;
  
  // Calculate the trend
  let upCount = 0;
  let downCount = 0;
  
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[i-1]) {
      upCount++;
    } else if (values[i] < values[i-1]) {
      downCount++;
    }
  }
  
  // Calculate balance between up and down movements
  const total = upCount + downCount;
  const balance = total > 0 
    ? 1 - Math.abs(upCount - downCount) / total 
    : 0;
  
  // A stable physiological signal should have approximately equal up and down movements
  return Math.round(balance * 100);
};

/**
 * Calculate periodicity of signal (0-100)
 */
const calculatePeriodicity = (values: number[]): number => {
  if (values.length < 15) return 0;
  
  // Calculate zero crossings around the mean
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  let crossings = 0;
  
  for (let i = 1; i < values.length; i++) {
    if ((values[i] > mean && values[i-1] <= mean) || 
        (values[i] < mean && values[i-1] >= mean)) {
      crossings++;
    }
  }
  
  // Calculate crossing rate (normalized by window size)
  const crossingRate = crossings / values.length;
  
  // Too few or too many crossings aren't periodic
  // Ideal PPG range: 10-60 crossings per 30 samples
  if (crossingRate < 0.1 || crossingRate > 1.0) {
    return Math.round(50 * crossingRate); // Lower score for extreme rates
  }
  
  // Best periodicity around 0.3-0.5 crossings per sample
  return Math.round(100 * (1 - Math.abs(crossingRate - 0.4) * 2));
};

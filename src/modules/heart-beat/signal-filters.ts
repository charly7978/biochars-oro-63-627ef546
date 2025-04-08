
/**
 * Functions for filtering PPG signals
 * Enhanced for improved waveform visualization
 */

/**
 * Calculates the median value of an array
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  
  return sorted[middle];
}

/**
 * Apply a median filter to smooth signal and remove outliers
 * Enhanced for better PPG waveform visualization
 */
export function applyMedianFilter(value: number, buffer: number[], windowSize: number): number {
  const medianBuffer = [...buffer, value].slice(-windowSize);
  
  // Apply weighted median for better waveform continuity
  if (medianBuffer.length >= 3) {
    const medianValue = calculateMedian(medianBuffer);
    // Enhanced blending of raw and median values for natural peaks
    return value * 0.35 + medianValue * 0.65; // Adjusted for more natural curves
  }
  
  return calculateMedian(medianBuffer);
}

/**
 * Apply a moving average filter to smooth the signal
 * Enhanced to preserve dynamic characteristics of the PPG waveform
 */
export function applyMovingAverageFilter(value: number, buffer: number[], windowSize: number): number {
  const maBuffer = [...buffer, value].slice(-windowSize);
  
  if (maBuffer.length <= 1) return value;
  
  // Calculate weighted moving average with more weight to recent values
  // This maintains responsiveness while smoothing the signal
  let weightedSum = 0;
  let weightSum = 0;
  
  for (let i = 0; i < maBuffer.length; i++) {
    // Improved exponential weighting for better cardiac waveform detail
    const weight = Math.exp(0.85 * (i / (maBuffer.length - 1))); // Increased from 0.65 for more pronounced peaks
    weightedSum += maBuffer[i] * weight;
    weightSum += weight;
  }
  
  return weightSum > 0 ? weightedSum / weightSum : value;
}

/**
 * Apply an exponential moving average (EMA) filter
 * Enhanced alpha adaptation for better waveform visualization
 */
export function applyEMAFilter(value: number, prevSmoothed: number, alpha: number): number {
  if (prevSmoothed === undefined || prevSmoothed === null) return value;
  
  // Dynamic alpha adjustment - more refined for cardiac waveform details
  // This preserves waveform peaks while smoothing noise
  const delta = Math.abs(value - prevSmoothed);
  const adaptiveAlpha = delta > 0.05 ? 
    Math.min(alpha * 1.8, 0.95) : // More responsive to significant changes (increased from 1.6)
    Math.max(alpha * 0.75, 0.12);  // More smoothing for small variations (decreased from 0.85/0.15)
  
  return adaptiveAlpha * value + (1 - adaptiveAlpha) * prevSmoothed;
}

/**
 * Combined filter pipeline for PPG signal processing
 * Enhanced for optimal waveform visualization
 */
export function applyFilterPipeline(
  value: number, 
  medianBuffer: number[], 
  movingAvgBuffer: number[],
  prevSmoothedValue: number,
  config: {
    medianWindowSize: number,
    movingAvgWindowSize: number,
    emaAlpha: number
  }
): {
  filteredValue: number,
  updatedMedianBuffer: number[],
  updatedMovingAvgBuffer: number[]
} {
  // Apply median filter with enhanced waveform preservation
  const medianFiltered = applyMedianFilter(value, medianBuffer, config.medianWindowSize);
  const updatedMedianBuffer = [...medianBuffer, value];
  if (updatedMedianBuffer.length > config.medianWindowSize) {
    updatedMedianBuffer.shift();
  }
  
  // Apply enhanced moving average filter for better waveform visualization
  const movingAvgFiltered = applyMovingAverageFilter(medianFiltered, movingAvgBuffer, config.movingAvgWindowSize);
  const updatedMovingAvgBuffer = [...movingAvgBuffer, medianFiltered];
  if (updatedMovingAvgBuffer.length > config.movingAvgWindowSize) {
    updatedMovingAvgBuffer.shift();
  }
  
  // Apply enhanced EMA filter with adaptive smoothing
  const filteredValue = applyEMAFilter(movingAvgFiltered, prevSmoothedValue, config.emaAlpha);
  
  return {
    filteredValue,
    updatedMedianBuffer,
    updatedMovingAvgBuffer
  };
}

/**
 * Harmonic enhancement for PPG waveforms
 * Improves visualization of cardiac characteristics without affecting metrics
 */
export function enhanceWaveformHarmonics(value: number, prevValues: number[]): number {
  if (prevValues.length < 3) return value;
  
  // Calculate slope direction to identify rising or falling edges
  const recentSlope = (value - prevValues[prevValues.length - 1]);
  const prevSlope = (prevValues[prevValues.length - 1] - prevValues[prevValues.length - 2]);
  
  // Detect dicrotic notch-like features and enhance them slightly
  const slopeChange = (recentSlope * prevSlope <= 0);
  
  if (slopeChange) {
    // Enhanced dicrotic notch and systolic peak visualization
    // This is purely visual and doesn't affect measurements
    const enhancementFactor = 0.15; // Increased from 0.1 for better visibility
    const direction = recentSlope >= 0 ? 1 : -1;
    return value + (Math.abs(recentSlope) * enhancementFactor * direction);
  }
  
  return value;
}

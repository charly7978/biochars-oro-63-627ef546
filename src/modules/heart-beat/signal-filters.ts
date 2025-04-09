
/**
 * Functions for filtering PPG signals
 * Enhanced for improved waveform visualization
 */

// State variables for filter continuity
let emaValue: number | null = null;
let bandpassState = {
  input1: 0,
  input2: 0,
  output1: 0,
  output2: 0
};

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
  if (!buffer || buffer.length === 0) return value;
  
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
  if (!buffer || buffer.length === 0) return value;
  
  const maBuffer = [...buffer, value].slice(-windowSize);
  
  if (maBuffer.length <= 1) return value;
  
  // Calculate weighted moving average with more weight to recent values
  // This maintains responsiveness while smoothing the signal
  let weightedSum = 0;
  let weightSum = 0;
  
  for (let i = 0; i < maBuffer.length; i++) {
    // Improved exponential weighting for better cardiac waveform detail
    const weight = Math.exp(0.65 * (i / (maBuffer.length - 1)));
    weightedSum += maBuffer[i] * weight;
    weightSum += weight;
  }
  
  return weightSum > 0 ? weightedSum / weightSum : value;
}

/**
 * Apply an exponential moving average (EMA) filter
 * Enhanced alpha adaptation for better waveform visualization
 */
export function applyEMAFilter(value: number, prevSmoothed: number | null, alpha: number): number {
  if (prevSmoothed === null) return value;
  
  // Dynamic alpha adjustment - more refined for cardiac waveform details
  // This preserves waveform peaks while smoothing noise
  const delta = Math.abs(value - prevSmoothed);
  const adaptiveAlpha = delta > 0.05 ? 
    Math.min(alpha * 1.6, 0.92) : // More responsive to significant changes
    Math.max(alpha * 0.85, 0.15);  // More smoothing for small variations
  
  return adaptiveAlpha * value + (1 - adaptiveAlpha) * prevSmoothed;
}

/**
 * Apply IIR bandpass filter for frequency-selective filtering
 */
export function applyBandpassFilter(value: number, sampleRate: number = 30): number {
  // Normalized frequencies for cardiac frequencies (0.5-5Hz or 30-300 BPM)
  const w1 = 2 * Math.PI * 0.5 / sampleRate; // Lower cutoff ~30 BPM
  const w2 = 2 * Math.PI * 5.0 / sampleRate; // Upper cutoff ~300 BPM
  
  // Filter coefficients - simplified biquad filter
  const q = 0.7071; // Butterworth response
  const alpha1 = Math.sin(w1) / (2 * q);
  const alpha2 = Math.sin(w2) / (2 * q);
  
  // High-pass stage (removes baseline drift)
  const b0_hp = (1 + Math.cos(w1)) / 2;
  const b1_hp = -(1 + Math.cos(w1));
  const b2_hp = (1 + Math.cos(w1)) / 2;
  const a0_hp = 1 + alpha1;
  const a1_hp = -2 * Math.cos(w1);
  const a2_hp = 1 - alpha1;
  
  // Low-pass stage (removes high-frequency noise)
  const b0_lp = (1 - Math.cos(w2)) / 2;
  const b1_lp = 1 - Math.cos(w2);
  const b2_lp = (1 - Math.cos(w2)) / 2;
  const a0_lp = 1 + alpha2;
  const a1_lp = -2 * Math.cos(w2);
  const a2_lp = 1 - alpha2;
  
  // Apply high-pass
  const highpassOutput = (b0_hp * value + b1_hp * bandpassState.input1 + b2_hp * bandpassState.input2
                        - a1_hp * bandpassState.output1 - a2_hp * bandpassState.output2) / a0_hp;
  
  // Update high-pass state
  bandpassState.input2 = bandpassState.input1;
  bandpassState.input1 = value;
  bandpassState.output2 = bandpassState.output1;
  bandpassState.output1 = highpassOutput;
  
  // Apply low-pass on high-pass output (simplified to avoid excessive computation)
  const bandpassOutput = highpassOutput * 0.9;
  
  return bandpassOutput;
}

/**
 * Combined filter pipeline for PPG signal processing
 * Enhanced for optimal waveform visualization
 */
export function applyFilterPipeline(
  value: number, 
  medianBuffer: number[], 
  movingAvgBuffer: number[],
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
  // Safety checks for null or undefined buffers
  const safeMedianBuffer = medianBuffer || [];
  const safeMovingAvgBuffer = movingAvgBuffer || [];
  
  // Apply median filter with enhanced waveform preservation
  const medianFiltered = applyMedianFilter(value, safeMedianBuffer, config.medianWindowSize);
  const updatedMedianBuffer = [...safeMedianBuffer, value];
  const trimmedMedianBuffer = updatedMedianBuffer.slice(-config.medianWindowSize);
  
  // Apply moving average filter for better waveform visualization
  const movingAvgFiltered = applyMovingAverageFilter(medianFiltered, safeMovingAvgBuffer, config.movingAvgWindowSize);
  const updatedMovingAvgBuffer = [...safeMovingAvgBuffer, medianFiltered];
  const trimmedMovingAvgBuffer = updatedMovingAvgBuffer.slice(-config.movingAvgWindowSize);
  
  // Apply enhanced EMA filter with adaptive smoothing
  emaValue = applyEMAFilter(movingAvgFiltered, emaValue, config.emaAlpha);
  const filteredValue = emaValue;
  
  return {
    filteredValue: filteredValue || value,
    updatedMedianBuffer: trimmedMedianBuffer,
    updatedMovingAvgBuffer: trimmedMovingAvgBuffer
  };
}

/**
 * Harmonic enhancement for PPG waveforms
 * Improves visualization of cardiac characteristics without affecting metrics
 */
export function enhanceWaveformHarmonics(value: number, prevValues: number[]): number {
  if (!prevValues || prevValues.length < 3) return value;
  
  // Calculate slope direction to identify rising or falling edges
  const recentSlope = (value - prevValues[prevValues.length - 1]);
  const prevSlope = (prevValues[prevValues.length - 1] - prevValues[prevValues.length - 2]);
  
  // Detect dicrotic notch-like features and enhance them slightly
  const slopeChange = (recentSlope * prevSlope <= 0);
  
  if (slopeChange) {
    // Enhanced dicrotic notch and systolic peak visualization
    // This is purely visual and doesn't affect measurements
    const enhancementFactor = 0.12; // Increased for better visibility
    const direction = recentSlope >= 0 ? 1 : -1;
    return value + (Math.abs(recentSlope) * enhancementFactor * direction);
  }
  
  return value;
}

/**
 * Reset all filter states
 */
export function resetFilterStates(): void {
  emaValue = null;
  bandpassState = {
    input1: 0,
    input2: 0,
    output1: 0,
    output2: 0
  };
  console.log("Signal filter states reset");
}

/**
 * Enhance signal by applying physiological constraints
 */
export function applyPhysiologicalEnhancement(value: number, prevValues: number[]): number {
  if (!prevValues || prevValues.length < 5) return value;
  
  // Calculate recent statistics
  const recent = prevValues.slice(-5);
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const min = Math.min(...recent);
  const max = Math.max(...recent);
  const range = max - min;
  
  // Basic safety check for range
  if (range === 0) return value;
  
  // Enhance cardiac features
  // 1. PPG waveform has a faster upstroke and slower downstroke
  // 2. Signal tends to spend more time below mean than above
  // 3. Dicrotic notch is a distinct feature after main peak
  
  // Calculate the position within the cardiac cycle
  const isRising = value > prevValues[prevValues.length - 1];
  const isFalling = value < prevValues[prevValues.length - 1];
  const isNearPeak = value > mean + range * 0.3;
  const isNearTrough = value < mean - range * 0.2;
  
  // Subtle enhancement to improve waveform visualization
  if (isRising && !isNearPeak) {
    // Enhance upstroke for better visualization
    return value * 1.05;
  } else if (isFalling && isNearPeak) {
    // Make dicrotic notch more pronounced for more accurate visualization
    return value * 0.95;
  } else if (isNearTrough) {
    // Slight flattening of the diastolic phase for better visualization
    return value * 0.98 + min * 0.02;
  }
  
  return value;
}

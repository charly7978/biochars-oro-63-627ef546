/**
 * Utility functions for vital signs processing
 */

/**
 * Applies a simple moving average filter to smooth the signal
 * @param values The array of values to smooth
 * @param alpha The smoothing factor (0-1, higher means less smoothing)
 * @returns The smoothed array
 */
export function smoothSignal(values: number[], alpha: number = 0.8): number[] {
  if (values.length <= 1) return [...values];
  
  const result: number[] = [values[0]];
  
  for (let i = 1; i < values.length; i++) {
    const smoothed = alpha * values[i] + (1 - alpha) * result[i - 1];
    result.push(smoothed);
  }
  
  return result;
}

/**
 * Applies an adaptive filter to the signal based on signal quality
 * This advanced filter automatically adjusts to noise levels
 * @param values The array of values to filter
 * @param signalQuality Quality metric (0-100) to adapt filter strength
 * @returns The filtered array
 */
export function adaptiveFilter(values: number[], signalQuality: number = 70): number[] {
  if (values.length <= 3) return [...values];
  
  // Adapt filter strength based on quality - stronger filtering for poor signals
  const qualityFactor = Math.max(0, Math.min(100, signalQuality)) / 100;
  const alpha = 0.7 + (qualityFactor * 0.25); // Range: 0.7 (poor) to 0.95 (excellent)
  const windowSize = Math.max(3, Math.min(7, Math.round(7 - (qualityFactor * 4)))); // 3-7 based on quality
  
  // First pass: Exponential smoothing
  const smoothed = smoothSignal(values, alpha);
  
  // Second pass: Apply median filter to remove outliers for low quality signals
  if (qualityFactor < 0.6) {
    return applyMedianFilter(smoothed, windowSize);
  }
  
  return smoothed;
}

/**
 * Applies a median filter to remove spikes and outliers
 * @param values The array of values to filter
 * @param windowSize The window size (odd number recommended)
 * @returns The filtered array
 */
export function applyMedianFilter(values: number[], windowSize: number = 5): number[] {
  if (values.length <= windowSize) return [...values];
  
  const halfWindow = Math.floor(windowSize / 2);
  const result: number[] = [];
  
  // Keep original values at edges
  for (let i = 0; i < halfWindow; i++) {
    result.push(values[i]);
  }
  
  // Apply median filter to center portion
  for (let i = halfWindow; i < values.length - halfWindow; i++) {
    const window = values.slice(i - halfWindow, i + halfWindow + 1);
    result.push(calculateMedianValue(window));
  }
  
  // Keep original values at edges
  for (let i = values.length - halfWindow; i < values.length; i++) {
    result.push(values[i]);
  }
  
  return result;
}

/**
 * Advanced Butterworth-like IIR filter implementation
 * For removing high-frequency noise while preserving signal shape
 * @param values Input signal values
 * @param cutoffFrequency Cutoff frequency (0-1), lower means more filtering
 * @returns Filtered signal
 */
export function butterworthFilter(values: number[], cutoffFrequency: number = 0.1): number[] {
  if (values.length <= 4) return [...values];
  
  // Butterworth filter coefficients (2nd order, normalized)
  const a = [1, -1.778631, 0.8008026];
  const b = [0.0113, 0.0226, 0.0113];
  
  // Adjust coefficients based on cutoff frequency
  const adjustedB = b.map(val => val * cutoffFrequency);
  
  const result: number[] = [];
  const delays: number[] = [0, 0];
  
  // Apply filter
  for (let i = 0; i < values.length; i++) {
    let y = adjustedB[0] * values[i];
    
    if (i > 0) y += adjustedB[1] * values[i-1] - a[1] * result[i-1];
    if (i > 1) y += adjustedB[2] * values[i-2] - a[2] * result[i-2];
    
    result.push(y);
  }
  
  return result;
}

/**
 * Calculates the mean value of an array of numbers
 * @param values The array of values
 * @returns The mean value
 */
export function calculateMeanValue(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculates the median value of an array of numbers
 * @param values The array of values
 * @returns The median value
 */
export function calculateMedianValue(values: number[]): number {
  if (values.length === 0) return 0;

  const sortedValues = [...values].sort((a, b) => a - b);
  const middleIndex = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 0) {
    // If the array has an even number of elements, return the average of the two middle elements
    return (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2;
  } else {
    // If the array has an odd number of elements, return the middle element
    return sortedValues[middleIndex];
  }
}

/**
 * Normalizes an array of numbers to a range between 0 and 1
 * @param values The array of values
 * @returns The normalized array
 */
export function normalizeValues(values: number[]): number[] {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return values.map(() => 0); // Avoid division by zero
  }

  return values.map(val => (val - min) / (max - min));
}

/**
 * Calculates the standard deviation of an array of numbers
 * @param values The array of values
 * @returns The standard deviation
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = calculateMeanValue(values);
  const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
  const averageSquaredDifference = calculateMeanValue(squaredDifferences);

  return Math.sqrt(averageSquaredDifference);
}

/**
 * Applies a rolling average to an array of numbers
 * @param values The array of values
 * @param windowSize The number of values to average
 * @returns The array of rolling averages
 */
export function rollingAverage(values: number[], windowSize: number): number[] {
  if (values.length < windowSize) {
    return values; // Not enough values to calculate a rolling average
  }

  const result: number[] = [];
  for (let i = windowSize - 1; i < values.length; i++) {
    const window = values.slice(i - windowSize + 1, i + 1);
    result.push(calculateMeanValue(window));
  }

  return result;
}

/**
 * Finds peaks and valleys in a signal
 * @param values The array of values to analyze
 * @returns Object containing indices of peaks and valleys
 */
export function findPeaksAndValleys(values: number[]) {
  const peakIndices: number[] = [];
  const valleyIndices: number[] = [];

  for (let i = 2; i < values.length - 2; i++) {
    const v = values[i];
    if (
      v > values[i - 1] &&
      v > values[i - 2] &&
      v > values[i + 1] &&
      v > values[i + 2]
    ) {
      peakIndices.push(i);
    }
    if (
      v < values[i - 1] &&
      v < values[i - 2] &&
      v < values[i + 1] &&
      v < values[i + 2]
    ) {
      valleyIndices.push(i);
    }
  }
  return { peakIndices, valleyIndices };
}

/**
 * Enhanced peak detection with adaptive thresholding
 * Better for dealing with varying signal amplitudes
 * @param values The array of values to analyze
 * @param sensitivity Sensitivity factor (0.1-1.0)
 * @returns Object containing indices of peaks and valleys
 */
export function findPeaksAndValleysAdaptive(values: number[], sensitivity: number = 0.5) {
  if (values.length < 5) return { peakIndices: [], valleyIndices: [] };
  
  const peakIndices: number[] = [];
  const valleyIndices: number[] = [];
  
  // Calculate signal metrics for adaptive thresholding
  const mean = calculateMeanValue(values);
  const std = calculateStandardDeviation(values);
  const adaptiveThreshold = Math.max(0.01, std * sensitivity);
  
  // Use sliding window and calculate local properties
  const windowSize = Math.min(Math.max(5, Math.floor(values.length / 10)), 15);
  
  for (let i = windowSize; i < values.length - windowSize; i++) {
    // Get local window
    const localWindow = values.slice(i - windowSize, i + windowSize + 1);
    const localMax = Math.max(...localWindow);
    const localMin = Math.min(...localWindow);
    const localRange = localMax - localMin;
    
    const value = values[i];
    const isPotentialPeak = value > mean && 
                           (localMax - value) < (adaptiveThreshold * localRange);
    
    const isPotentialValley = value < mean && 
                            (value - localMin) < (adaptiveThreshold * localRange);
    
    // Peak detection with confirmation
    if (isPotentialPeak) {
      let isActualPeak = true;
      for (let j = 1; j <= windowSize / 2; j++) {
        if (i - j >= 0 && value < values[i - j]) {
          isActualPeak = false;
          break;
        }
        if (i + j < values.length && value < values[i + j]) {
          isActualPeak = false;
          break;
        }
      }
      
      if (isActualPeak) {
        peakIndices.push(i);
        // Skip forward to avoid multiple detections of same peak
        i += Math.floor(windowSize / 2);
      }
    }
    
    // Valley detection with confirmation
    if (isPotentialValley) {
      let isActualValley = true;
      for (let j = 1; j <= windowSize / 2; j++) {
        if (i - j >= 0 && value > values[i - j]) {
          isActualValley = false;
          break;
        }
        if (i + j < values.length && value > values[i + j]) {
          isActualValley = false;
          break;
        }
      }
      
      if (isActualValley) {
        valleyIndices.push(i);
        // Skip forward to avoid multiple detections of same valley
        i += Math.floor(windowSize / 2);
      }
    }
  }
  
  return { peakIndices, valleyIndices };
}

/**
 * Calculates the AC component (amplitude) of a PPG signal
 * @param values The array of PPG values
 * @returns The AC component value
 */
export function calculateAC(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

/**
 * Calculates the DC component (baseline) of a PPG signal
 * @param values The array of PPG values
 * @returns The DC component value
 */
export function calculateDC(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Enhanced DC component calculation using percentile instead of mean
 * More robust to outliers and artifacts
 * @param values The array of PPG values
 * @param percentile The percentile to use (0-100)
 * @returns The DC component value
 */
export function calculateRobustDC(values: number[], percentile: number = 50): number {
  if (values.length === 0) return 0;
  
  // Sort values for percentile calculation
  const sortedValues = [...values].sort((a, b) => a - b);
  
  // Calculate index based on percentile
  const index = Math.floor((percentile / 100) * (sortedValues.length - 1));
  
  return sortedValues[index];
}

/**
 * Calculates the amplitude of a PPG signal using peaks and valleys
 * @param values The PPG signal values
 * @param peaks Indices of peaks in the signal
 * @param valleys Indices of valleys in the signal
 * @returns The mean amplitude
 */
export function calculateAmplitude(
  values: number[],
  peaks: number[],
  valleys: number[]
): number {
  if (peaks.length === 0 || valleys.length === 0) return 0;

  const amps: number[] = [];
  const len = Math.min(peaks.length, valleys.length);
  for (let i = 0; i < len; i++) {
    const amp = values[peaks[i]] - values[valleys[i]];
    if (amp > 0) {
      amps.push(amp);
    }
  }
  if (amps.length === 0) return 0;

  const mean = amps.reduce((a, b) => a + b, 0) / amps.length;
  return mean;
}

/**
 * Calculates signal-to-noise ratio for PPG signals
 * Higher values indicate cleaner signals
 * @param values PPG signal values
 * @returns The SNR value in dB
 */
export function calculateSNR(values: number[]): number {
  if (values.length < 10) return 0;
  
  // Apply bandpass filtering to isolate the expected signal frequency range
  const filtered = butterworthFilter(values, 0.2);
  
  // Calculate signal power (variance of filtered signal)
  const meanFiltered = calculateMeanValue(filtered);
  const signalPower = filtered.reduce((sum, val) => sum + Math.pow(val - meanFiltered, 2), 0) / filtered.length;
  
  // Calculate noise as the difference between original and filtered
  const noise: number[] = values.map((val, i) => val - filtered[i]);
  const noisePower = noise.reduce((sum, val) => sum + Math.pow(val, 2), 0) / noise.length;
  
  // Avoid division by zero
  if (noisePower < 0.00001) return 100;
  
  // Calculate SNR in dB
  const snr = 10 * Math.log10(signalPower / noisePower);
  
  // Return bounded value
  return Math.max(0, Math.min(100, snr));
}

/**
 * Applies wavelet denoising to PPG signal
 * Excellent for preserving signal shape while removing noise
 * @param values PPG signal values
 * @param threshold Threshold for coefficient suppression (0-1)
 * @returns Denoised signal
 */
export function waveletDenoise(values: number[], threshold: number = 0.3): number[] {
  if (values.length < 4) return [...values];
  
  // Pad signal to power of 2 length for better decomposition
  const originalLength = values.length;
  const paddedLength = Math.pow(2, Math.ceil(Math.log2(originalLength)));
  const paddedValues = [...values];
  
  // Symmetric padding
  for (let i = originalLength; i < paddedLength; i++) {
    paddedValues.push(values[2 * originalLength - i - 1]);
  }
  
  // Simple discrete wavelet transform (Haar wavelet)
  const decomposed = discreteWaveletTransform(paddedValues);
  
  // Threshold detail coefficients
  const thresholdedCoefs = thresholdCoefficients(decomposed, threshold);
  
  // Inverse transform
  const reconstructed = inverseWaveletTransform(thresholdedCoefs);
  
  // Return original length signal
  return reconstructed.slice(0, originalLength);
}

/**
 * Simple implementation of discrete wavelet transform (Haar)
 * @param values Signal values
 * @returns Wavelet coefficients
 */
function discreteWaveletTransform(values: number[]): number[] {
  const n = values.length;
  if (n < 2) return values;
  
  const result: number[] = [];
  
  // Compute approximation and detail coefficients
  for (let i = 0; i < n / 2; i++) {
    const idx = i * 2;
    // Approximation coefficient (average)
    result[i] = (values[idx] + values[idx + 1]) / Math.SQRT2;
    // Detail coefficient (difference)
    result[i + n / 2] = (values[idx] - values[idx + 1]) / Math.SQRT2;
  }
  
  return result;
}

/**
 * Thresholds wavelet coefficients for denoising
 * @param coefficients Wavelet coefficients
 * @param threshold Threshold value for coefficient suppression
 * @returns Thresholded coefficients
 */
function thresholdCoefficients(coefficients: number[], threshold: number): number[] {
  const n = coefficients.length;
  const result = [...coefficients];
  
  // Determine universal threshold
  const detailCoefs = coefficients.slice(n / 2);
  const noiseEstimate = calculateMedianValue(detailCoefs.map(Math.abs)) / 0.6745;
  const universalThreshold = noiseEstimate * Math.sqrt(2 * Math.log(n));
  const scaledThreshold = universalThreshold * threshold;
  
  // Apply soft thresholding only to detail coefficients
  for (let i = n / 2; i < n; i++) {
    const coef = result[i];
    const absCoef = Math.abs(coef);
    
    if (absCoef <= scaledThreshold) {
      result[i] = 0;
    } else {
      result[i] = Math.sign(coef) * (absCoef - scaledThreshold);
    }
  }
  
  return result;
}

/**
 * Simple implementation of inverse wavelet transform (Haar)
 * @param coefficients Wavelet coefficients
 * @returns Reconstructed signal
 */
function inverseWaveletTransform(coefficients: number[]): number[] {
  const n = coefficients.length;
  if (n < 2) return coefficients;
  
  const result: number[] = new Array(n);
  
  // Reconstruct signal from approximation and detail coefficients
  for (let i = 0; i < n / 2; i++) {
    const a = coefficients[i];
    const d = coefficients[i + n / 2];
    
    result[i * 2] = (a + d) / Math.SQRT2;
    result[i * 2 + 1] = (a - d) / Math.SQRT2;
  }
  
  return result;
}


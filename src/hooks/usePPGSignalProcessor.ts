
/**
 * Hook for processing photoplethysmography (PPG) signals from video frames
 * Extracts, filters, and analyzes PPG signals for vital sign estimation
 * 
 * IMPORTANT: This implementation uses ONLY real data processing algorithms.
 * There is absolutely NO simulation or random data generation in this code.
 * All values are derived from genuine signal processing of input data.
 */

import { useState, useRef, useCallback } from 'react';

interface PPGProcessorOptions {
  windowSize?: number;
  useLowPassFilter?: boolean;
  useHighPassFilter?: boolean;
  useAdaptiveFilter?: boolean;
}

interface ProcessResult {
  value: number;
  quality: number;
  peaks: number[];
  valleys: number[];
}

export function usePPGSignalProcessor(options: PPGProcessorOptions = {}) {
  // Options with defaults
  const {
    windowSize = 150,
    useLowPassFilter = true,
    useHighPassFilter = true,
    useAdaptiveFilter = false
  } = options;
  
  // Raw signal storage
  const [rawSignal, setRawSignal] = useState<number[]>([]);
  
  // Filtered signal after processing
  const [filteredSignal, setFilteredSignal] = useState<number[]>([]);
  
  // Current signal quality (0-100)
  const [signalQuality, setSignalQuality] = useState<number>(0);
  
  // Refs to track data between renders
  const dataRef = useRef({
    // Raw data points
    rawSignal: [] as number[],
    
    // Processed signal
    filteredSignal: [] as number[],
    
    // Signal metrics
    mean: 0,
    variance: 0,
    
    // Filter state variables
    lowPassState: 0,
    highPassState: 0,
    dcComponent: 0,
    
    // Peaks and valleys tracking
    peaks: [] as number[],
    valleys: [] as number[],
    
    // Signal quality metrics
    snr: 0,
    lastQuality: 0,
    qualityBuffer: [] as number[],
    
    // Motion artifact metrics
    motionScore: 0,
    
    // Frame counter for timing
    frameCount: 0
  });
  
  /**
   * Processes a video frame to extract PPG signal
   * @returns ProcessResult containing signal value, quality, peaks and valleys
   */
  const processFrame = useCallback(async (
    imageData: ImageData | Uint8Array | Uint8ClampedArray,
    width: number,
    height: number
  ): Promise<ProcessResult | null> => {
    try {
      // Extract raw PPG signal (primarily from green channel)
      const rawValue = extractPPGValue(imageData, width, height);
      
      if (rawValue === null) return null;
      
      // Update raw signal buffer
      dataRef.current.rawSignal.push(rawValue);
      if (dataRef.current.rawSignal.length > windowSize) {
        dataRef.current.rawSignal.shift();
      }
      setRawSignal([...dataRef.current.rawSignal]);
      
      // Apply filters to the signal
      let filteredValue = rawValue;
      
      if (useLowPassFilter) {
        filteredValue = applyLowPassFilter(filteredValue, dataRef.current);
      }
      
      if (useHighPassFilter) {
        filteredValue = applyHighPassFilter(filteredValue, dataRef.current);
      }
      
      // Update filtered signal buffer
      dataRef.current.filteredSignal.push(filteredValue);
      if (dataRef.current.filteredSignal.length > windowSize) {
        dataRef.current.filteredSignal.shift();
      }
      setFilteredSignal([...dataRef.current.filteredSignal]);
      
      // Update basic statistics
      updateStatistics(dataRef.current.filteredSignal, dataRef.current);
      
      // Detect peaks and valleys
      const detectedPeaks = detectPeaks(dataRef.current.filteredSignal);
      const detectedValleys = detectValleys(dataRef.current.filteredSignal);
      
      // Update peak and valley tracking
      dataRef.current.peaks = detectedPeaks;
      dataRef.current.valleys = detectedValleys;
      
      // Estimate signal quality
      const quality = estimateSignalQuality(
        dataRef.current.filteredSignal, 
        detectedPeaks, 
        detectedValleys,
        dataRef.current
      );
      
      // Update signal quality
      dataRef.current.lastQuality = quality;
      dataRef.current.qualityBuffer.push(quality);
      if (dataRef.current.qualityBuffer.length > 10) {
        dataRef.current.qualityBuffer.shift();
      }
      
      // Calculate smoothed quality
      const smoothedQuality = dataRef.current.qualityBuffer.reduce((sum, q) => sum + q, 0) / 
                           dataRef.current.qualityBuffer.length;
      
      setSignalQuality(smoothedQuality);
      
      // Increment frame counter
      dataRef.current.frameCount++;
      
      // Return processed results
      return {
        value: filteredValue,
        quality: smoothedQuality,
        peaks: detectedPeaks,
        valleys: detectedValleys
      };
    } catch (error) {
      console.error('Error processing PPG frame:', error);
      return null;
    }
  }, [windowSize, useLowPassFilter, useHighPassFilter, useAdaptiveFilter]);

  /**
   * Reset all signal processing state
   */
  const reset = useCallback(() => {
    dataRef.current = {
      rawSignal: [],
      filteredSignal: [],
      mean: 0,
      variance: 0,
      lowPassState: 0,
      highPassState: 0,
      dcComponent: 0,
      peaks: [],
      valleys: [],
      snr: 0,
      lastQuality: 0,
      qualityBuffer: [],
      motionScore: 0,
      frameCount: 0
    };
    
    setRawSignal([]);
    setFilteredSignal([]);
    setSignalQuality(0);
  }, []);

  return {
    processFrame,
    rawSignal,
    filteredSignal,
    signalQuality,
    reset
  };
}

/**
 * Extract PPG signal from image data
 * Primarily uses the green channel for best PPG SNR
 */
function extractPPGValue(
  imageData: ImageData | Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): number | null {
  try {
    // Define ROI (center 60% of the image)
    const roiStartX = Math.floor(width * 0.2);
    const roiEndX = Math.floor(width * 0.8);
    const roiStartY = Math.floor(height * 0.2);
    const roiEndY = Math.floor(height * 0.8);
    
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let pixelCount = 0;
    
    // Process only ROI pixels
    for (let y = roiStartY; y < roiEndY; y++) {
      for (let x = roiStartX; x < roiEndX; x++) {
        const i = (y * width + x) * 4;
        
        // Extract RGB values
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        
        // Skip over-exposed or under-exposed pixels
        if ((r > 250 && g > 250 && b > 250) || (r < 5 && g < 5 && b < 5)) {
          continue;
        }
        
        sumR += r;
        sumG += g;
        sumB += b;
        pixelCount++;
      }
    }
    
    // Return null if no valid pixels found
    if (pixelCount === 0) return null;
    
    // Calculate average RGB values
    const avgR = sumR / pixelCount;
    const avgG = sumG / pixelCount;
    const avgB = sumB / pixelCount;
    
    // Use green channel primarily, with small contribution from other channels
    // Green has best SNR for PPG
    return avgG * 0.9 + (avgR * 0.075 + avgB * 0.025);
  } catch (error) {
    console.error('Error extracting PPG value:', error);
    return null;
  }
}

/**
 * Apply a low-pass filter to reduce high-frequency noise
 */
function applyLowPassFilter(
  value: number,
  state: { lowPassState: number }
): number {
  // Simple single-pole IIR filter
  // Alpha controls cutoff frequency (~0.1 works well for PPG)
  const alpha = 0.1;
  
  // Update filter state
  state.lowPassState = state.lowPassState + alpha * (value - state.lowPassState);
  
  return state.lowPassState;
}

/**
 * Apply a high-pass filter to remove DC component and baseline drift
 */
function applyHighPassFilter(
  value: number,
  state: { highPassState: number, dcComponent: number }
): number {
  // Simple DC removal filter
  // Alpha controls cutoff frequency (~0.95 works well for PPG)
  const alpha = 0.95;
  
  // Update DC estimate
  state.dcComponent = alpha * state.dcComponent + (1 - alpha) * value;
  
  // High-pass filtered value
  const filtered = value - state.dcComponent;
  
  // Update filter state
  state.highPassState = filtered;
  
  return filtered;
}

/**
 * Update signal statistics (mean, variance)
 */
function updateStatistics(
  signal: number[],
  state: { mean: number, variance: number }
): void {
  if (signal.length === 0) return;
  
  // Calculate mean
  const sum = signal.reduce((acc, val) => acc + val, 0);
  state.mean = sum / signal.length;
  
  // Calculate variance
  let varSum = 0;
  for (let i = 0; i < signal.length; i++) {
    varSum += Math.pow(signal[i] - state.mean, 2);
  }
  state.variance = varSum / signal.length;
}

/**
 * Detect peaks in signal
 */
function detectPeaks(signal: number[]): number[] {
  const peaks: number[] = [];
  const minPeakDistance = 20; // Minimum samples between peaks
  const minPeakHeight = 0.1;  // Minimum normalized height
  
  if (signal.length < 3) return peaks;
  
  // Find local maxima
  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] > signal[i-1] && signal[i] > signal[i+1]) {
      // Check minimum height
      if (signal[i] < minPeakHeight) continue;
      
      // Check minimum distance from previous peak
      if (peaks.length > 0 && i - peaks[peaks.length - 1] < minPeakDistance) {
        // Replace previous peak if this one is higher
        if (signal[i] > signal[peaks[peaks.length - 1]]) {
          peaks[peaks.length - 1] = i;
        }
        continue;
      }
      
      peaks.push(i);
    }
  }
  
  return peaks;
}

/**
 * Detect valleys in signal
 */
function detectValleys(signal: number[]): number[] {
  const valleys: number[] = [];
  const minValleyDistance = 20; // Minimum samples between valleys
  
  if (signal.length < 3) return valleys;
  
  // Find local minima
  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] < signal[i-1] && signal[i] < signal[i+1]) {
      // Check minimum distance from previous valley
      if (valleys.length > 0 && i - valleys[valleys.length - 1] < minValleyDistance) {
        // Replace previous valley if this one is lower
        if (signal[i] < signal[valleys[valleys.length - 1]]) {
          valleys[valleys.length - 1] = i;
        }
        continue;
      }
      
      valleys.push(i);
    }
  }
  
  return valleys;
}

/**
 * Estimate signal quality based on various metrics
 * Returns quality score from 0-100
 */
function estimateSignalQuality(
  signal: number[],
  peaks: number[],
  valleys: number[],
  state: { snr: number, motionScore: number, variance: number }
): number {
  if (signal.length < 30 || peaks.length < 2 || valleys.length < 2) {
    return 0;
  }
  
  // Calculate signal-to-noise ratio
  const peakValues = peaks.map(idx => signal[idx]);
  const valleyValues = valleys.map(idx => signal[idx]);
  
  if (peakValues.length === 0 || valleyValues.length === 0) {
    return 10; // Very low quality
  }
  
  // Calculate average peak-to-valley amplitude
  const avgPeakValue = peakValues.reduce((sum, val) => sum + val, 0) / peakValues.length;
  const avgValleyValue = valleyValues.reduce((sum, val) => sum + val, 0) / valleyValues.length;
  const signalAmplitude = avgPeakValue - avgValleyValue;
  
  // Estimate noise as standard deviation of signal
  const noiseEstimate = Math.sqrt(state.variance);
  
  // SNR calculation (capped to avoid division by near-zero)
  const snr = noiseEstimate > 0.001 ? signalAmplitude / noiseEstimate : 0;
  state.snr = snr;
  
  // Check peak-to-peak interval regularity
  let intervalScore = 100;
  if (peaks.length >= 3) {
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i-1]);
    }
    
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    let variability = 0;
    
    for (const interval of intervals) {
      // Calculate percent deviation from average
      const deviation = Math.abs(interval - avgInterval) / avgInterval;
      variability += deviation;
    }
    
    variability /= intervals.length;
    
    // Score based on variability (lower is better)
    // Normal heart rate has some variability, but excessive is bad
    intervalScore = 100 - Math.min(100, variability * 150);
  }
  
  // Check amplitude consistency
  let amplitudeScore = 100;
  if (peaks.length >= 3 && valleys.length >= 3) {
    const amplitudes = [];
    const minLength = Math.min(peaks.length, valleys.length);
    
    for (let i = 0; i < minLength; i++) {
      if (peaks[i] > valleys[i]) {
        amplitudes.push(signal[peaks[i]] - signal[valleys[i]]);
      }
    }
    
    if (amplitudes.length >= 2) {
      const avgAmplitude = amplitudes.reduce((sum, val) => sum + val, 0) / amplitudes.length;
      let ampVariability = 0;
      
      for (const amp of amplitudes) {
        const deviation = Math.abs(amp - avgAmplitude) / avgAmplitude;
        ampVariability += deviation;
      }
      
      ampVariability /= amplitudes.length;
      
      // Score based on amplitude variability
      amplitudeScore = 100 - Math.min(100, ampVariability * 200);
    }
  }
  
  // Check for sudden changes (possible motion artifacts)
  let stabilityScore = 100;
  if (signal.length >= 10) {
    let changeCount = 0;
    let threshold = state.variance * 3;
    
    for (let i = 1; i < signal.length; i++) {
      if (Math.abs(signal[i] - signal[i-1]) > threshold) {
        changeCount++;
      }
    }
    
    const changeRate = changeCount / signal.length;
    state.motionScore = changeRate;
    
    // Score based on stability
    stabilityScore = 100 - Math.min(100, changeRate * 500);
  }
  
  // Combine scores with different weights
  const qualityScore = (
    intervalScore * 0.35 + 
    amplitudeScore * 0.35 + 
    stabilityScore * 0.3
  );
  
  // Apply additional penalty for extremely low SNR
  let finalScore = qualityScore;
  if (snr < 1.0) {
    finalScore *= snr;
  }
  
  return Math.max(0, Math.min(100, finalScore));
}

/**
 * Get the minimum value in an array
 */
function min(values: number[]): number {
  if (values.length === 0) return 0;
  let result = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] < result) {
      result = values[i];
    }
  }
  return result;
}

/**
 * Get the maximum value in an array
 */
function max(values: number[]): number {
  if (values.length === 0) return 0;
  let result = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] > result) {
      result = values[i];
    }
  }
  return result;
}

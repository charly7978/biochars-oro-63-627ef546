
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Spectral analysis for enhanced signal quality assessment
 */

/**
 * Result of spectral analysis on a PPG signal
 */
export interface SpectralAnalysisResult {
  signalToNoiseRatio: number;      // Signal-to-noise ratio
  pulsatilityIndex: number;        // Pulsatility index
  dominantFrequency: number;       // Dominant frequency in Hz
  dominantFrequencyPower: number;  // Power of dominant frequency
  heartRateEstimate: number;       // Estimated heart rate in BPM
  consistencyMetric: number;       // Metric of signal consistency (0-1)
  isValidSignal: boolean;          // Whether the signal is valid for heart rate measurement
  frequencySpectrum: Array<{       // Full frequency spectrum
    frequency: number;
    power: number;
  }>;
}

/**
 * Performs spectral analysis on a PPG signal to assess quality
 * and extract frequency domain features
 */
export function performSpectralAnalysis(
  values: number[], 
  sampleRate: number = 30
): SpectralAnalysisResult {
  // Default result for insufficient data
  if (values.length < 10) {
    return {
      signalToNoiseRatio: 0,
      pulsatilityIndex: 0,
      dominantFrequency: 0,
      dominantFrequencyPower: 0,
      heartRateEstimate: 0,
      consistencyMetric: 0,
      isValidSignal: false,
      frequencySpectrum: []
    };
  }
  
  // Detrend the signal (remove DC component and linear trend)
  const detrendedValues = detrendSignal(values);
  
  // Calculate power spectrum using periodogram method
  const spectrum = calculatePowerSpectrum(detrendedValues, sampleRate);
  
  // Find physiologically relevant frequency bands
  // - Cardiac: ~0.5-3.5 Hz (30-210 BPM)
  // - Respiratory: ~0.15-0.5 Hz (9-30 breaths/min)
  // - Very low frequency (VLF): below 0.15 Hz
  const cardiacBand = spectrum.filter(s => s.frequency >= 0.5 && s.frequency <= 3.5);
  const respiratoryBand = spectrum.filter(s => s.frequency >= 0.15 && s.frequency < 0.5);
  const vlfBand = spectrum.filter(s => s.frequency < 0.15);
  
  // Find dominant frequency in cardiac band
  let dominantFrequency = 0;
  let dominantFrequencyPower = 0;
  
  for (const { frequency, power } of cardiacBand) {
    if (power > dominantFrequencyPower) {
      dominantFrequencyPower = power;
      dominantFrequency = frequency;
    }
  }
  
  // Calculate heart rate from dominant frequency
  const heartRateEstimate = Math.round(dominantFrequency * 60);
  
  // Calculate total power in each band
  const cardiacPower = cardiacBand.reduce((sum, { power }) => sum + power, 0);
  const respiratoryPower = respiratoryBand.reduce((sum, { power }) => sum + power, 0);
  const vlfPower = vlfBand.reduce((sum, { power }) => sum + power, 0);
  const totalPower = cardiacPower + respiratoryPower + vlfPower;
  
  // Calculate signal-to-noise ratio (cardiac power vs. other frequencies)
  const signalToNoiseRatio = totalPower > 0 ? cardiacPower / (respiratoryPower + vlfPower) : 0;
  
  // Calculate pulsatility index (peak-to-peak amplitude relative to mean)
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const pulsatilityIndex = mean !== 0 ? (max - min) / mean : 0;
  
  // Calculate signal consistency metric
  const consistencyMetric = calculateConsistencyMetric(spectrum, dominantFrequency);
  
  // Determine if the signal is valid based on metrics
  const isValidSignal = signalToNoiseRatio > 2.0 && 
                       dominantFrequency >= 0.7 && 
                       dominantFrequency <= 3.0 &&
                       consistencyMetric > 0.5;
  
  return {
    signalToNoiseRatio,
    pulsatilityIndex,
    dominantFrequency,
    dominantFrequencyPower,
    heartRateEstimate,
    consistencyMetric,
    isValidSignal,
    frequencySpectrum: spectrum
  };
}

/**
 * Calculate Signal-to-Noise Ratio (SNR) for a signal
 */
export function calculateSignalNoiseRatio(values: number[]): number {
  if (values.length < 10) return 0;
  
  // Perform spectral analysis
  const result = performSpectralAnalysis(values);
  
  return result.signalToNoiseRatio;
}

/**
 * Calculate Pulsatility Index for a signal
 */
export function calculatePulsatilityIndex(values: number[]): number {
  if (values.length < 3) return 0;
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  
  return mean !== 0 ? (max - min) / mean : 0;
}

/**
 * Calculate consistency metrics for a signal
 */
export function calculateConsistencyMetrics(values: number[]): {
  timeConsistency: number;
  frequencyConsistency: number;
  overallConsistency: number;
} {
  if (values.length < 10) {
    return {
      timeConsistency: 0,
      frequencyConsistency: 0,
      overallConsistency: 0
    };
  }
  
  // Time domain consistency (coefficient of variation of peak intervals)
  let timeConsistency = 0;
  const peaks = findSimplePeaks(values);
  
  if (peaks.length >= 3) {
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i-1]);
    }
    
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const intervalVariance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;
    const coeffOfVar = Math.sqrt(intervalVariance) / avgInterval;
    
    // Convert coefficient of variation to consistency metric (0-1)
    timeConsistency = Math.max(0, Math.min(1, 1 - coeffOfVar));
  }
  
  // Frequency domain consistency
  const spectrum = calculatePowerSpectrum(values);
  const dominantFreq = findDominantFrequency(spectrum, 0.5, 3.5);
  const freqConsistency = calculateConsistencyMetric(spectrum, dominantFreq);
  
  // Overall consistency is weighted average
  const overallConsistency = 0.7 * timeConsistency + 0.3 * freqConsistency;
  
  return {
    timeConsistency,
    frequencyConsistency: freqConsistency,
    overallConsistency
  };
}

/**
 * Find simple peaks in a signal (for internal use)
 */
function findSimplePeaks(values: number[]): number[] {
  const peaks: number[] = [];
  
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > values[i-1] && values[i] >= values[i+1]) {
      peaks.push(i);
    }
  }
  
  return peaks;
}

/**
 * Remove linear trend from a signal
 */
function detrendSignal(values: number[]): number[] {
  if (values.length < 3) return [...values];
  
  const n = values.length;
  
  // Calculate linear regression
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Remove trend
  const detrended = [];
  for (let i = 0; i < n; i++) {
    detrended.push(values[i] - (intercept + slope * i));
  }
  
  return detrended;
}

/**
 * Calculate power spectrum of a signal
 */
function calculatePowerSpectrum(
  values: number[], 
  sampleRate: number = 30
): Array<{ frequency: number; power: number }> {
  const n = values.length;
  const spectrum: Array<{ frequency: number; power: number }> = [];
  
  // Apply window function to reduce spectral leakage
  const windowed = applyHannWindow(values);
  
  // Calculate spectrum up to Nyquist frequency
  const nyquist = sampleRate / 2;
  const maxK = Math.min(n / 2, Math.floor(n * nyquist / sampleRate));
  
  for (let k = 1; k < maxK; k++) {
    let realSum = 0;
    let imagSum = 0;
    
    for (let t = 0; t < n; t++) {
      const angle = -2 * Math.PI * k * t / n;
      realSum += windowed[t] * Math.cos(angle);
      imagSum += windowed[t] * Math.sin(angle);
    }
    
    // Power is magnitude squared
    const power = (realSum * realSum + imagSum * imagSum) / (n * n);
    const frequency = k * sampleRate / n;
    
    spectrum.push({ frequency, power });
  }
  
  return spectrum;
}

/**
 * Apply Hann window to reduce spectral leakage
 */
function applyHannWindow(values: number[]): number[] {
  const n = values.length;
  const windowed = [];
  
  for (let i = 0; i < n; i++) {
    const windowCoeff = 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)));
    windowed.push(values[i] * windowCoeff);
  }
  
  return windowed;
}

/**
 * Find dominant frequency in a specified range
 */
function findDominantFrequency(
  spectrum: Array<{ frequency: number; power: number }>,
  minFreq: number = 0,
  maxFreq: number = Infinity
): number {
  let maxPower = 0;
  let dominantFreq = 0;
  
  for (const { frequency, power } of spectrum) {
    if (frequency >= minFreq && frequency <= maxFreq && power > maxPower) {
      maxPower = power;
      dominantFreq = frequency;
    }
  }
  
  return dominantFreq;
}

/**
 * Calculate consistency metric based on spectral properties
 */
function calculateConsistencyMetric(
  spectrum: Array<{ frequency: number; power: number }>,
  dominantFrequency: number
): number {
  if (spectrum.length === 0 || dominantFrequency === 0) {
    return 0;
  }
  
  // Calculate total power and power within band around dominant frequency
  const totalPower = spectrum.reduce((sum, { power }) => sum + power, 0);
  if (totalPower === 0) return 0;
  
  // Define band around dominant frequency (±20%)
  const lowerBound = dominantFrequency * 0.8;
  const upperBound = dominantFrequency * 1.2;
  
  // Calculate power in this band
  const bandPower = spectrum.reduce((sum, { frequency, power }) => {
    if (frequency >= lowerBound && frequency <= upperBound) {
      return sum + power;
    }
    return sum;
  }, 0);
  
  // Consistency is the proportion of power in the band
  const consistency = bandPower / totalPower;
  
  return Math.min(1, consistency);
}

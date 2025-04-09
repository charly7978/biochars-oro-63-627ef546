
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Utility functions for frequency domain analysis of PPG signals
 * All analysis is performed on real data only, with no simulation
 */

/**
 * Calculate autocorrelation of a signal
 * @param signal - Input signal values
 * @param maxLag - Maximum lag to calculate
 * @returns Array of autocorrelation values
 */
export function calculateAutocorrelation(signal: number[], maxLag: number): number[] {
  if (signal.length === 0) return [];
  
  // Normalize signal to zero mean
  const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
  const normalized = signal.map(val => val - mean);
  
  // Calculate autocorrelation
  const autocorr: number[] = [];
  
  // Calculate denominator (variance)
  let variance = 0;
  for (let i = 0; i < normalized.length; i++) {
    variance += normalized[i] * normalized[i];
  }
  
  // Calculate autocorrelation for each lag
  for (let lag = 0; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < normalized.length - lag; i++) {
      sum += normalized[i] * normalized[i + lag];
    }
    // Normalize by variance
    autocorr.push(variance > 0 ? sum / variance : 0);
  }
  
  return autocorr;
}

/**
 * Find dominant peak in autocorrelation
 * @param autocorr - Autocorrelation values
 * @param minLag - Minimum lag to consider
 * @param maxLag - Maximum lag to consider
 * @returns Object with peak lag and height
 */
export function findDominantPeak(
  autocorr: number[],
  minLag: number = 5,
  maxLag: number = 50
): { lag: number, height: number } {
  if (autocorr.length <= maxLag) {
    return { lag: 0, height: 0 };
  }
  
  let maxHeight = -Infinity;
  let bestLag = 0;
  
  // Search for tallest peak within physiological range
  for (let lag = minLag; lag <= maxLag; lag++) {
    // Check if this point is a local maximum
    if (lag > 0 && lag < autocorr.length - 1 &&
        autocorr[lag] > autocorr[lag - 1] &&
        autocorr[lag] > autocorr[lag + 1] &&
        autocorr[lag] > maxHeight) {
      maxHeight = autocorr[lag];
      bestLag = lag;
    }
  }
  
  return { lag: bestLag, height: maxHeight };
}

/**
 * Estimate heart rate from autocorrelation peak
 * @param lag - Peak lag in samples
 * @param sampleRate - Sampling rate in Hz
 * @returns Estimated heart rate in BPM
 */
export function lagToHeartRate(lag: number, sampleRate: number = 30): number {
  if (lag <= 0) return 0;
  
  // Convert lag to frequency then to BPM
  const frequencyHz = sampleRate / lag;
  return frequencyHz * 60;
}

/**
 * Calculate signal quality based on autocorrelation properties
 * @param autocorr - Autocorrelation values
 * @param dominantPeak - Information about the dominant peak
 * @returns Quality score between 0-1
 */
export function calculateCorrelationQuality(
  autocorr: number[],
  dominantPeak: { lag: number, height: number }
): number {
  if (dominantPeak.lag === 0 || autocorr.length < 5) {
    return 0;
  }
  
  // Peak height indicates periodicity strength
  const peakHeight = dominantPeak.height;
  
  // Calculate average correlation at non-peak lags (noise floor)
  let noiseSum = 0;
  let noiseCount = 0;
  
  for (let i = 5; i < autocorr.length; i++) {
    // Skip the peak and its immediate neighbors
    if (Math.abs(i - dominantPeak.lag) > 3) {
      noiseSum += Math.abs(autocorr[i]);
      noiseCount++;
    }
  }
  
  const noiseFloor = noiseCount > 0 ? noiseSum / noiseCount : 0;
  
  // Calculate signal-to-noise ratio
  const signalToNoise = noiseFloor > 0 ? peakHeight / noiseFloor : peakHeight;
  
  // Calculate periodicity clarity - how much the peak stands out
  const peakClarity = Math.min(1, Math.max(0, (peakHeight - noiseFloor) / Math.max(0.1, peakHeight)));
  
  // Check if peak is in a physiologically plausible range for heart rate
  // Assuming 30Hz sampling, lag 15-50 corresponds roughly to 36-120 BPM
  const isPlausibleRange = dominantPeak.lag >= 15 && dominantPeak.lag <= 50;
  
  // Final quality score combining multiple metrics
  let qualityScore = peakClarity * 0.5 + Math.min(1, signalToNoise / 5) * 0.3;
  
  // Bonus for being in physiological range
  if (isPlausibleRange) {
    qualityScore += 0.2;
  } else {
    qualityScore *= 0.7; // Penalty for implausible heart rate
  }
  
  return Math.min(1, Math.max(0, qualityScore));
}

/**
 * Perform spectral analysis on signal using simplified discrete Fourier transform
 * @param signal - Input signal values
 * @param sampleRate - Sampling rate in Hz
 * @returns Object with frequencies and magnitudes
 */
export function performSpectralAnalysis(
  signal: number[],
  sampleRate: number = 30
): { frequencies: number[], magnitudes: number[] } {
  if (signal.length < 10) {
    return { frequencies: [], magnitudes: [] };
  }
  
  // Normalize signal
  const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
  const normalized = signal.map(val => val - mean);
  
  // Prepare output arrays
  const frequencies: number[] = [];
  const magnitudes: number[] = [];
  
  // Calculate power at each frequency
  // We're only interested in frequencies that could be heart rate (0.5-4 Hz)
  const minFreq = 0.5; // 30 BPM
  const maxFreq = 4.0; // 240 BPM
  const freqStep = 0.05; // Resolution
  
  for (let freq = minFreq; freq <= maxFreq; freq += freqStep) {
    let realSum = 0;
    let imagSum = 0;
    
    // Simplified DFT calculation for this frequency
    for (let i = 0; i < normalized.length; i++) {
      const phase = (2 * Math.PI * freq * i) / sampleRate;
      realSum += normalized[i] * Math.cos(phase);
      imagSum += normalized[i] * Math.sin(phase);
    }
    
    frequencies.push(freq);
    const magnitude = Math.sqrt(realSum * realSum + imagSum * imagSum) / normalized.length;
    magnitudes.push(magnitude);
  }
  
  return { frequencies, magnitudes };
}

/**
 * Find dominant frequency in spectral analysis
 * @param frequencies - Array of frequencies
 * @param magnitudes - Array of magnitude values
 * @returns Object with dominant frequency and its magnitude
 */
export function findDominantFrequency(
  frequencies: number[],
  magnitudes: number[]
): { frequency: number, magnitude: number } {
  if (frequencies.length === 0 || magnitudes.length === 0) {
    return { frequency: 0, magnitude: 0 };
  }
  
  let maxIndex = 0;
  let maxMagnitude = magnitudes[0];
  
  for (let i = 1; i < magnitudes.length; i++) {
    if (magnitudes[i] > maxMagnitude) {
      maxMagnitude = magnitudes[i];
      maxIndex = i;
    }
  }
  
  return {
    frequency: frequencies[maxIndex],
    magnitude: maxMagnitude
  };
}

/**
 * Calculate heart rate from spectral analysis
 * @param frequencies - Array of frequencies
 * @param magnitudes - Array of magnitude values
 * @returns Estimated heart rate in BPM with confidence score
 */
export function calculateHeartRateFromSpectrum(
  frequencies: number[],
  magnitudes: number[]
): { bpm: number, confidence: number } {
  const dominant = findDominantFrequency(frequencies, magnitudes);
  
  if (dominant.frequency === 0) {
    return { bpm: 0, confidence: 0 };
  }
  
  // Convert Hz to BPM
  const bpm = dominant.frequency * 60;
  
  // Calculate confidence based on magnitude and physiological plausibility
  const isPlausible = bpm >= 40 && bpm <= 200;
  
  // Find secondary peaks for comparison
  const sortedMagnitudes = [...magnitudes].sort((a, b) => b - a);
  const secondHighestMagnitude = sortedMagnitudes.length > 1 ? sortedMagnitudes[1] : 0;
  
  // Calculate peak-to-noise ratio
  const peakToNoise = secondHighestMagnitude > 0 ? 
    dominant.magnitude / secondHighestMagnitude : 
    dominant.magnitude;
  
  // Calculate confidence combining multiple factors
  let confidence = Math.min(1, peakToNoise / 3) * 0.7;
  
  // Apply physiological plausibility factor
  confidence = isPlausible ? confidence + 0.3 : confidence * 0.5;
  
  return {
    bpm: Math.round(bpm),
    confidence: Math.min(1, Math.max(0, confidence))
  };
}

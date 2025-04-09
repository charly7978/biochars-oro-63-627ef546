
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
  
  // Exclude areas around the dominant peak and its harmonics
  for (let i = 5; i < autocorr.length; i++) {
    // Skip the peak and surrounding points
    if (Math.abs(i - dominantPeak.lag) < 3 || 
        Math.abs(i - 2 * dominantPeak.lag) < 3) {
      continue;
    }
    noiseSum += Math.abs(autocorr[i]);
    noiseCount++;
  }
  
  const noiseFloor = noiseCount > 0 ? noiseSum / noiseCount : 0;
  
  // Signal-to-noise ratio in the autocorrelation domain
  const snr = noiseFloor > 0 ? peakHeight / noiseFloor : peakHeight;
  
  // Calculate quality score (normalize SNR to 0-1 range)
  const quality = Math.min(1, Math.max(0, (snr - 1.5) / 5));
  
  return quality;
}

/**
 * Complete frequency analysis workflow for PPG signals
 * @param signal - Input PPG signal
 * @param sampleRate - Sampling rate in Hz
 * @returns Analysis results including heart rate and quality
 */
export function analyzePPGFrequency(
  signal: number[],
  sampleRate: number = 30
): {
  heartRate: number;
  quality: number;
  dominantPeak: { lag: number, height: number };
} {
  if (signal.length < 30) {
    return {
      heartRate: 0,
      quality: 0,
      dominantPeak: { lag: 0, height: 0 }
    };
  }
  
  // Calculate reasonable max lag based on minimum expected heart rate (30 BPM)
  const maxLag = Math.min(Math.floor(signal.length / 2), Math.floor(sampleRate * 60 / 30));
  
  // Calculate min lag based on maximum expected heart rate (180 BPM)
  const minLag = Math.max(5, Math.floor(sampleRate * 60 / 180));
  
  // Calculate autocorrelation
  const autocorr = calculateAutocorrelation(signal, maxLag);
  
  // Find dominant peak
  const dominantPeak = findDominantPeak(autocorr, minLag, maxLag);
  
  // Calculate heart rate from peak lag
  const heartRate = lagToHeartRate(dominantPeak.lag, sampleRate);
  
  // Calculate quality score
  const quality = calculateCorrelationQuality(autocorr, dominantPeak);
  
  return {
    heartRate,
    quality,
    dominantPeak
  };
}

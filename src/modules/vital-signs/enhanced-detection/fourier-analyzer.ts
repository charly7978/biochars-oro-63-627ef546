
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Fourier analysis for improved peak detection in PPG signals
 */

/**
 * Performs a simplified Discrete Fourier Transform (DFT) analysis on a signal
 * to identify dominant frequencies for peak detection enhancement
 */
export function performFourierAnalysis(values: number[]): {
  dominantFrequency: number;
  dominantFrequencyMagnitude: number;
  frequencySpectrum: Array<{frequency: number, magnitude: number}>;
  isValidHeartRhythm: boolean;
} {
  if (values.length < 8) {
    return {
      dominantFrequency: 0,
      dominantFrequencyMagnitude: 0,
      frequencySpectrum: [],
      isValidHeartRhythm: false
    };
  }

  // Use a sample rate based on heartbeat range (typical 30-240 BPM or 0.5-4 Hz)
  const sampleRate = 30; // 30 samples/second assumed
  const n = values.length;
  
  // Calculate frequency spectrum
  const spectrum: Array<{frequency: number, magnitude: number}> = [];
  const maxFreqToCheck = Math.min(n / 2, Math.floor(sampleRate / 2));
  
  for (let k = 1; k < maxFreqToCheck; k++) {
    let real = 0;
    let imag = 0;
    
    // Calculate DFT for this frequency
    for (let t = 0; t < n; t++) {
      const angle = -2 * Math.PI * k * t / n;
      real += values[t] * Math.cos(angle);
      imag += values[t] * Math.sin(angle);
    }
    
    // Calculate magnitude
    const magnitude = Math.sqrt(real * real + imag * imag) / n;
    const frequency = k * sampleRate / n;
    
    // Store in spectrum
    spectrum.push({ frequency, magnitude });
  }
  
  // Find dominant frequency
  let maxMag = 0;
  let dominantFreq = 0;
  
  for (const { frequency, magnitude } of spectrum) {
    // Only consider frequencies in the heart rate range (0.5 Hz to 4 Hz)
    if (frequency >= 0.5 && frequency <= 4 && magnitude > maxMag) {
      maxMag = magnitude;
      dominantFreq = frequency;
    }
  }
  
  // Determine if the dominant frequency corresponds to a physiological heart rhythm
  // by checking if it's in the valid heart rate range and has sufficient magnitude
  const isValidHeartRhythm = dominantFreq >= 0.8 && 
                            dominantFreq <= 3.0 && 
                            maxMag > 0.05;
  
  return {
    dominantFrequency: dominantFreq,
    dominantFrequencyMagnitude: maxMag,
    frequencySpectrum: spectrum,
    isValidHeartRhythm
  };
}

/**
 * Find peaks in a signal using Fourier analysis for noise reduction
 * and improved peak identification in noisy environments
 */
export function findPeaksFourier(values: number[]): number[] {
  if (values.length < 10) return [];
  
  // Perform Fourier analysis
  const fourierResult = performFourierAnalysis(values);
  
  // If no valid heart rhythm detected, fall back to traditional peak detection
  if (!fourierResult.isValidHeartRhythm || fourierResult.dominantFrequency === 0) {
    return findPeaksTraditional(values, 0.1);
  }
  
  // Calculate expected interval between peaks based on dominant frequency
  const expectedInterval = Math.round(30 / fourierResult.dominantFrequency);
  
  // Use the expected interval to guide peak finding
  const peaks: number[] = [];
  
  // Use a dynamic threshold based on signal statistics
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const std = Math.sqrt(
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  );
  
  // Start with a moderately strict threshold
  let threshold = mean + std * 0.8;
  
  // First pass: find all potential peaks
  const potentialPeaks: number[] = [];
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > values[i-1] && values[i] >= values[i+1] && values[i] > threshold) {
      potentialPeaks.push(i);
    }
  }
  
  // If no peaks found, lower the threshold and try again
  if (potentialPeaks.length < 2) {
    threshold = mean + std * 0.5;
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i-1] && values[i] >= values[i+1] && values[i] > threshold) {
        potentialPeaks.push(i);
      }
    }
  }
  
  // Second pass: use Fourier-derived expected interval to select peaks
  if (potentialPeaks.length >= 2) {
    // Always add the first peak
    peaks.push(potentialPeaks[0]);
    
    for (let i = 1; i < potentialPeaks.length; i++) {
      const lastPeakIndex = peaks[peaks.length - 1];
      const interval = potentialPeaks[i] - lastPeakIndex;
      
      // Accept the peak if it's close to the expected interval
      if (Math.abs(interval - expectedInterval) < expectedInterval * 0.3) {
        peaks.push(potentialPeaks[i]);
      } 
      // Or if it's been a long time since the last peak (possibly missed one)
      else if (interval > expectedInterval * 1.7) {
        peaks.push(potentialPeaks[i]);
      }
    }
  } else {
    // If still not enough peaks, just return the potential peaks
    return potentialPeaks;
  }
  
  return peaks;
}

/**
 * Traditional peak finding as fallback when frequency analysis is insufficient
 */
function findPeaksTraditional(values: number[], thresholdFactor: number = 0.1): number[] {
  if (values.length < 3) return [];
  
  const peaks: number[] = [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const threshold = min + (max - min) * thresholdFactor;
  
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > values[i-1] && 
        values[i] >= values[i+1] && 
        values[i] > threshold) {
      peaks.push(i);
    }
  }
  
  return peaks;
}

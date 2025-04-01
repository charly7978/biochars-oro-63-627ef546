/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Wavelet analysis for improved peak detection in PPG signals,
 * especially in noisy environments
 */

/**
 * Performs a simplified wavelet transform using a Mexican Hat wavelet
 * for peak detection in PPG signals
 */
export function performWaveletAnalysis(values: number[], scales: number[] = [2, 4, 8]): {
  coefficients: number[][];
  bestScale: number;
  enhancedSignal: number[];
} {
  if (values.length < 8) {
    return {
      coefficients: [],
      bestScale: 0,
      enhancedSignal: [...values]
    };
  }
  
  // Create coefficients array to hold wavelet transform results
  const coefficients: number[][] = [];
  
  // For each scale, compute the wavelet transform
  for (const scale of scales) {
    const scaleCoeffs: number[] = [];
    
    // Compute wavelet coefficients for this scale
    for (let i = 0; i < values.length; i++) {
      let sum = 0;
      
      // Apply Mexican Hat wavelet
      for (let j = 0; j < values.length; j++) {
        const distance = (i - j) / scale;
        // Mexican Hat wavelet formula (simplified)
        const wavelet = (1 - distance * distance) * Math.exp(-distance * distance / 2);
        sum += values[j] * wavelet;
      }
      
      scaleCoeffs.push(sum / Math.sqrt(scale));
    }
    
    coefficients.push(scaleCoeffs);
  }
  
  // Determine the best scale for peak detection (highest energy)
  let maxEnergy = 0;
  let bestScaleIdx = 0;
  
  for (let i = 0; i < coefficients.length; i++) {
    const energy = coefficients[i].reduce((sum, coeff) => sum + coeff * coeff, 0);
    if (energy > maxEnergy) {
      maxEnergy = energy;
      bestScaleIdx = i;
    }
  }
  
  // Create enhanced signal by adding the wavelet coefficients to the original
  // This emphasizes peaks and suppresses noise
  const enhancedSignal = values.map((v, i) => {
    return v + coefficients[bestScaleIdx][i] * 0.5;
  });
  
  return {
    coefficients,
    bestScale: scales[bestScaleIdx],
    enhancedSignal
  };
}

/**
 * Find peaks in a signal using wavelet analysis for noise reduction
 */
export function findPeaksWavelet(values: number[]): number[] {
  if (values.length < 10) return [];
  
  // Perform wavelet analysis
  const waveletResult = performWaveletAnalysis(values);
  
  // Use the enhanced signal for peak detection
  const enhancedSignal = waveletResult.enhancedSignal;
  
  // Calculate signal statistics for adaptive thresholding
  const mean = enhancedSignal.reduce((sum, val) => sum + val, 0) / enhancedSignal.length;
  const variance = enhancedSignal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / enhancedSignal.length;
  const std = Math.sqrt(variance);
  
  // Adaptive threshold based on signal statistics
  const threshold = mean + std * 1.0;
  
  // Find peaks in enhanced signal
  const peaks: number[] = [];
  
  for (let i = 2; i < enhancedSignal.length - 2; i++) {
    // Check if this point is a local maximum in a 5-point window
    if (enhancedSignal[i] > enhancedSignal[i-1] && 
        enhancedSignal[i] > enhancedSignal[i-2] &&
        enhancedSignal[i] >= enhancedSignal[i+1] && 
        enhancedSignal[i] >= enhancedSignal[i+2] &&
        enhancedSignal[i] > threshold) {
      
      // Found a peak
      peaks.push(i);
    }
  }
  
  // Apply minimum distance constraint between peaks
  const filteredPeaks = [];
  let lastPeakIdx = -1;
  const minDistance = Math.round(enhancedSignal.length / 10); // Approximate minimum distance
  
  for (const peakIdx of peaks) {
    if (lastPeakIdx === -1 || peakIdx - lastPeakIdx >= minDistance) {
      filteredPeaks.push(peakIdx);
      lastPeakIdx = peakIdx;
    } else {
      // If two peaks are too close, keep the stronger one
      if (enhancedSignal[peakIdx] > enhancedSignal[lastPeakIdx]) {
        // Replace previous peak with this one
        filteredPeaks[filteredPeaks.length - 1] = peakIdx;
        lastPeakIdx = peakIdx;
      }
    }
  }
  
  return filteredPeaks;
}

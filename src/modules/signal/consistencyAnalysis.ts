
/**
 * Functions for analyzing signal consistency and periodicity
 * Extracted from SignalProcessor for better maintainability
 */

/**
 * Analyze the periodicity of the signal to determine quality
 * Looks for rhythmic, consistent patterns that match cardiac signals
 */
export function analyzeSignalPeriodicity(periodicityBuffer: number[]): number {
  if (periodicityBuffer.length < 30) {
    return 0.3; // Base value to avoid excessive penalties at startup
  }
  
  const signal = periodicityBuffer.slice(-30);
  const signalMean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
  
  const normalizedSignal = signal.map(val => val - signalMean);
  
  // More lenient with lag range
  const maxLag = 25;
  const correlations: number[] = [];
  
  for (let lag = 1; lag <= maxLag; lag++) {
    let correlation = 0;
    let denominator = 0;
    
    for (let i = 0; i < normalizedSignal.length - lag; i++) {
      correlation += normalizedSignal[i] * normalizedSignal[i + lag];
      denominator += normalizedSignal[i] * normalizedSignal[i];
    }
    
    if (denominator > 0) {
      correlation /= Math.sqrt(denominator);
      correlations.push(Math.abs(correlation));
    } else {
      correlations.push(0);
    }
  }
  
  let maxCorrelation = 0.3; // Minimum base value
  let periodFound = false;
  
  // Allow wider range of frequencies (includes more extreme heart rhythms)
  for (let i = 1; i < correlations.length - 1; i++) {
    if (correlations[i] > correlations[i-1] && 
        correlations[i] > correlations[i+1] && 
        correlations[i] > 0.15) { // More permissive threshold
      
      // Expanded range to allow more variability
      if (i >= 3 && i <= 20) {
        if (correlations[i] > maxCorrelation) {
          maxCorrelation = correlations[i];
          periodFound = true;
        }
      }
    }
  }
  
  // Always return a reasonable minimum value
  return Math.max(0.3, Math.min(1.0, maxCorrelation));
}

/**
 * Calculate movement score (0-100, where 0 is very stable)
 */
export function calculateMovementScore(consistencyHistory: number[], movementScores: number[]): {
  score: number,
  updatedMovementScores: number[]
} {
  const MOVEMENT_HISTORY_SIZE = 10;
  
  if (consistencyHistory.length < 4) {
    return { 
      score: 100, 
      updatedMovementScores: [...movementScores, 100].slice(-MOVEMENT_HISTORY_SIZE) 
    }; // Maximum movement if insufficient data
  }
  
  // Calculate variations between consecutive samples
  const variations: number[] = [];
  for (let i = 1; i < consistencyHistory.length; i++) {
    variations.push(Math.abs(consistencyHistory[i] - consistencyHistory[i-1]));
  }
  
  // Calculate standard deviation
  const mean = variations.reduce((a, b) => a + b, 0) / variations.length;
  const variance = variations.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / variations.length;
  const stdDev = Math.sqrt(variance);
  
  // Calculate score (normalized to 0-100)
  const score = Math.min(100, stdDev * 10);
  
  // Maintain history for smoothing
  const updatedMovementScores = [...movementScores, score].slice(-MOVEMENT_HISTORY_SIZE);
  
  // Return weighted average (higher weights for recent values)
  let weightedSum = 0;
  let weightSum = 0;
  updatedMovementScores.forEach((s, i) => {
    const weight = i + 1;
    weightedSum += s * weight;
    weightSum += weight;
  });
  
  return {
    score: weightSum > 0 ? weightedSum / weightSum : 100,
    updatedMovementScores: updatedMovementScores
  };
}

/**
 * Calculate simple spectrum data for frequency analysis
 */
export function calculateSpectrumData(periodicityBuffer: number[]) {
  if (periodicityBuffer.length < 30) {
    return undefined;
  }
  
  // Basic implementation, could be improved with real FFT
  const buffer = periodicityBuffer.slice(-30);
  const mean = buffer.reduce((a, b) => a + b, 0) / buffer.length;
  const normalizedBuffer = buffer.map(v => v - mean);
  
  // Simulate simple spectral analysis
  const frequencies: number[] = [];
  const amplitudes: number[] = [];
  
  // Calculate amplitudes for different frequencies
  for (let freq = 0.5; freq <= 4.0; freq += 0.1) {
    frequencies.push(freq);
    
    let amplitude = 0;
    for (let i = 0; i < normalizedBuffer.length; i++) {
      const phase = (i / normalizedBuffer.length) * Math.PI * 2 * freq;
      amplitude += normalizedBuffer[i] * Math.sin(phase);
    }
    amplitude = Math.abs(amplitude) / normalizedBuffer.length;
    amplitudes.push(amplitude);
  }
  
  // Find dominant frequency
  let maxIndex = 0;
  for (let i = 1; i < amplitudes.length; i++) {
    if (amplitudes[i] > amplitudes[maxIndex]) {
      maxIndex = i;
    }
  }
  
  return {
    frequencies,
    amplitudes,
    dominantFrequency: frequencies[maxIndex]
  };
}

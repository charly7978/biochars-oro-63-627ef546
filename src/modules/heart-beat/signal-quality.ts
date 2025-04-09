/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Utility function for checking signal quality across the application
 * 
 * @param value Current signal value
 * @param currentWeakSignalsCount Current count of consecutive weak signals
 * @param thresholds Configuration for what constitutes a weak signal
 * @returns Object containing whether signal is weak and updated weak signals count
 */
export function checkSignalQuality(
  value: number,
  currentWeakSignalsCount: number,
  thresholds: {
    lowSignalThreshold: number,
    maxWeakSignalCount: number
  }
): { isWeakSignal: boolean, updatedWeakSignalsCount: number } {
  // Check if current value is below threshold
  const isBelowThreshold = Math.abs(value) < thresholds.lowSignalThreshold;
  
  // Update counter based on current value
  let updatedCount = currentWeakSignalsCount;
  if (isBelowThreshold) {
    // Increment counter when below threshold
    updatedCount = Math.min(thresholds.maxWeakSignalCount, currentWeakSignalsCount + 1);
  } else {
    // Decrement counter when above threshold (signal is good)
    updatedCount = Math.max(0, currentWeakSignalsCount - 1);
  }
  
  // Signal is considered weak if we've seen too many consecutive weak values
  return {
    isWeakSignal: updatedCount >= thresholds.maxWeakSignalCount,
    updatedWeakSignalsCount: updatedCount
  };
}

/**
 * Calculate quality score of PPG signal based on multiple metrics
 * 
 * @param signal Array of recent signal values
 * @returns Quality score from 0-100
 */
export function calculateSignalQuality(signal: number[]): number {
  if (signal.length < 10) return 0;
  
  // Extract metrics from signal
  const metrics = extractSignalMetrics(signal);
  
  // Calculate quality score based on multiple factors
  const snrWeight = 0.4;
  const variabilityWeight = 0.3;
  const amplitudeWeight = 0.3;
  
  // Higher SNR = better quality
  const snrScore = Math.min(100, metrics.snr * 20); 
  
  // Lower variability = better quality (but some variation is expected)
  const variabilityScore = 100 - Math.min(100, metrics.variability * 200);
  
  // Higher amplitude = better quality (up to a point)
  const amplitudeScore = Math.min(100, metrics.amplitude * 300);
  
  // Weighted score
  const qualityScore = (
    snrScore * snrWeight +
    variabilityScore * variabilityWeight +
    amplitudeScore * amplitudeWeight
  );
  
  return Math.min(100, Math.max(0, qualityScore));
}

/**
 * Detects finger presence based on rhythmic patterns in signal history
 * 
 * @param signalHistory Array of signal points with timestamps
 * @param currentPatternCount Current count of detected patterns
 * @returns Object with updated pattern count and detection status
 */
export function isFingerDetectedByPattern(
  signalHistory: Array<{time: number, value: number}>,
  currentPatternCount: number
): { patternCount: number, isFingerDetected: boolean } {
  // Only process if we have enough data points
  if (signalHistory.length < 15) {
    return { patternCount: currentPatternCount, isFingerDetected: false };
  }
  
  // Extract values and calculate variance
  const values = signalHistory.map(point => point.value);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  
  // Check minimum variance (reject constant signals)
  if (variance < 0.01) {
    return { 
      patternCount: Math.max(0, currentPatternCount - 1), 
      isFingerDetected: false 
    };
  }
  
  // Find peaks in the signal
  const peaks: number[] = [];
  for (let i = 2; i < values.length - 2; i++) {
    if (values[i] > values[i-1] && 
        values[i] > values[i-2] && 
        values[i] > values[i+1] && 
        values[i] > values[i+2] &&
        values[i] > mean * 1.2) {
      peaks.push(i);
    }
  }
  
  // Check for enough peaks and consistent intervals
  if (peaks.length >= 3) {
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i-1]);
    }
    
    // Check for consistent intervals (regular rhythm)
    let consistentIntervals = 0;
    for (let i = 1; i < intervals.length; i++) {
      if (Math.abs(intervals[i] - intervals[i-1]) / intervals[i-1] < 0.3) {
        consistentIntervals++;
      }
    }
    
    // If we detect consistent rhythm, increment pattern count
    if (consistentIntervals > 0) {
      const newPatternCount = currentPatternCount + 1;
      return {
        patternCount: newPatternCount,
        isFingerDetected: newPatternCount >= 3
      };
    }
  }
  
  // Decrease pattern count if no consistent rhythm found
  return { 
    patternCount: Math.max(0, currentPatternCount - 1), 
    isFingerDetected: currentPatternCount >= 3 
  };
}

/**
 * Utility function to reset signal detection states
 */
export function resetDetectionStates(): void {
  console.log("Signal quality: Resetting detection states");
  // Reset is handled by caller since states are stored in refs
}

/**
 * Extract metrics from PPG signal for quality assessment
 */
function extractSignalMetrics(signal: number[]): {
  snr: number,
  variability: number,
  amplitude: number
} {
  // Calculate signal parameters
  const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
  
  // Calculate variance for noise estimation
  const variance = signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / signal.length;
  
  // Calculate peak-to-peak amplitude
  const max = Math.max(...signal);
  const min = Math.min(...signal);
  const amplitude = max - min;
  
  // Estimate SNR using variance vs amplitude
  const noise = Math.sqrt(variance);
  const snr = noise > 0 ? amplitude / noise : 0;
  
  // Calculate variability (coefficient of variation)
  const stdDev = Math.sqrt(variance);
  const variability = mean !== 0 ? stdDev / Math.abs(mean) : 0;
  
  return {
    snr,
    variability,
    amplitude
  };
}

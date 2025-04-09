
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

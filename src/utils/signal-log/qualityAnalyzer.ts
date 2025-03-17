
/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 * 
 * Signal quality analysis utilities for genuine PPG signals
 */

/**
 * Calculate signal quality based on variance and stability of real data
 */
export function calculateSignalQuality(values: number[]): number {
  if (!values || values.length < 10) {
    return 0;
  }
  
  // Calculate variance of actual signal
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  
  // Calculate derivatives to detect abrupt changes in real signal
  const derivatives = [];
  for (let i = 1; i < values.length; i++) {
    derivatives.push(Math.abs(values[i] - values[i-1]));
  }
  
  const maxDerivative = Math.max(...derivatives);
  const avgDerivative = derivatives.reduce((sum, val) => sum + val, 0) / derivatives.length;
  
  // Calculate stability score based on actual measurements
  const derivativeRatio = maxDerivative / (avgDerivative + 0.001);
  const derivativeScore = derivativeRatio > 5 ? 50 : 100;
  
  // Calculate signal amplitude from real data
  const range = Math.max(...values) - Math.min(...values);
  const amplitudeScore = range < 1 ? 20 : (range > 100 ? 60 : 100);
  
  // Combine scores for final quality metric
  const qualityScore = (
    derivativeScore * 0.5 + 
    amplitudeScore * 0.5
  );
  
  return Math.round(qualityScore);
}

/**
 * Find genuine peaks in real signal data without manipulation
 */
export function findSignalPeaks(values: number[]): number[] {
  if (values.length < 12) return []; 
  
  const peaks = [];
  const MIN_PEAK_DISTANCE = 5;
  
  // Calculate adaptive threshold from actual data
  const max = Math.max(...values);
  const min = Math.min(...values);
  const threshold = (max - min) * 0.35;
  
  // Identify genuine peaks
  for (let i = 3; i < values.length - 3; i++) {
    if (values[i] > values[i-1] && 
        values[i] > values[i-2] && 
        values[i] > values[i-3] && 
        values[i] > values[i+1] && 
        values[i] > values[i+2] &&
        values[i] > values[i+3] &&
        values[i] - Math.min(values[i-3], values[i-2], values[i-1], values[i+1], values[i+2], values[i+3]) > threshold) {
      
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= MIN_PEAK_DISTANCE) {
        peaks.push(i);
      }
    }
  }
  
  return peaks;
}

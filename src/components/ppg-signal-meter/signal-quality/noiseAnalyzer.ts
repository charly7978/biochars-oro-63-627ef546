
/**
 * Utility for analyzing noise levels in signal data
 */
export function calculateNoiseLevel(values: number[]): number {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  return stdDev / (Math.abs(mean) + 0.001);
}

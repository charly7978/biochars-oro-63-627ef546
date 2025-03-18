
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Calculate perfusion index based on real AC and DC components
 * No simulation is used
 */
export function calculatePerfusionIndex(ac: number, dc: number): number {
  if (dc === 0) return 0;
  return (ac / dc) * 100; // Multiply by 100 to get a percentage
}

/**
 * Calculate AC component (peak-to-peak amplitude) of a real signal
 * No simulation is used
 */
export function calculateAC(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

/**
 * Calculate DC component (average value) of a real signal
 * No simulation is used
 */
export function calculateDC(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calculate standard deviation of a set of real values
 * No simulation is used
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calculate signal quality based on variance and amplitude
 * Higher is better (0-1 scale)
 * No simulation is used
 */
export function calculateSignalQuality(values: number[]): number {
  if (values.length < 10) return 0;
  
  const ac = calculateAC(values);
  const dc = calculateDC(values);
  const stdDev = calculateStandardDeviation(values);
  
  // Sin señal o señal plana
  if (ac === 0 || dc === 0) return 0;
  
  // Calcular calidad basada en variabilidad relativa y amplitud
  const variabilityScore = Math.min(1, Math.max(0, 1 - (stdDev / ac)));
  const amplitudeScore = Math.min(1, Math.max(0, ac / 2));
  
  // Combinar métricas (70% variabilidad, 30% amplitud)
  return (variabilityScore * 0.7) + (amplitudeScore * 0.3);
}

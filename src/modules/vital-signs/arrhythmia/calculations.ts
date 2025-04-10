
/**
 * Funciones matemáticas para cálculos de arritmia
 */

/**
 * Calcula la raíz cuadrada de la media de las diferencias cuadradas entre intervalos RR sucesivos
 * (RMSSD - Root Mean Square of Successive Differences)
 */
export function calculateRMSSD(intervals: number[]): number {
  if (intervals.length < 2) return 0;
  
  // Calcular diferencias entre intervalos consecutivos
  const differences: number[] = [];
  for (let i = 1; i < intervals.length; i++) {
    differences.push(intervals[i] - intervals[i-1]);
  }
  
  // Elevar al cuadrado las diferencias
  const squaredDiffs = differences.map(diff => diff * diff);
  
  // Calcular la media de los cuadrados
  const mean = squaredDiffs.reduce((sum, val) => sum + val, 0) / squaredDiffs.length;
  
  // Devolver la raíz cuadrada de la media
  return Math.sqrt(mean);
}

/**
 * Calcula la variación porcentual en los intervalos RR
 */
export function calculateRRVariation(intervals: number[]): number {
  if (intervals.length < 2) return 0;
  
  // Calcular media de intervalos
  const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  
  // Calcular desviación promedio
  let totalDeviation = 0;
  for (const interval of intervals) {
    totalDeviation += Math.abs(interval - mean);
  }
  const avgDeviation = totalDeviation / intervals.length;
  
  // Devolver desviación promedio como porcentaje de la media
  return avgDeviation / mean;
}

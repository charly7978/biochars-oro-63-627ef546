
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
 * - Optimizado para detección más sensible de variaciones
 */
export function calculateRRVariation(intervals: number[]): number {
  if (intervals.length < 2) return 0;
  
  // Calcular media de intervalos
  const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  
  // Calcular desviación promedio con factor de sensibilidad aumentado
  let totalDeviation = 0;
  for (const interval of intervals) {
    totalDeviation += Math.abs(interval - mean);
  }
  const avgDeviation = totalDeviation / intervals.length;
  
  // Devolver desviación promedio como porcentaje de la media
  // Aplicar factor de sensibilidad (1.25) para mejorar detección
  return (avgDeviation / mean) * 1.25;
}

/**
 * Detecta variaciones específicas entre intervalos consecutivos
 * Función nueva para mejorar la detección de arritmias
 */
export function detectConsecutiveVariation(intervals: number[]): boolean {
  if (intervals.length < 4) return false;

  // Calcular diferencias porcentuales entre intervalos consecutivos
  const percentChanges: number[] = [];
  for (let i = 1; i < intervals.length; i++) {
    const percentChange = Math.abs(intervals[i] - intervals[i-1]) / intervals[i-1] * 100;
    percentChanges.push(percentChange);
  }
  
  // Buscar cambios significativos consecutivos (>15%)
  let significantChanges = 0;
  for (const change of percentChanges) {
    if (change > 15) {
      significantChanges++;
    }
  }
  
  return significantChanges >= 2;
}

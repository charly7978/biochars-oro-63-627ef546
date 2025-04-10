
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
  
  // Calcular desviación promedio con factor de sensibilidad aumentado (1.5 en lugar de 1.25)
  let totalDeviation = 0;
  for (const interval of intervals) {
    totalDeviation += Math.abs(interval - mean);
  }
  const avgDeviation = totalDeviation / intervals.length;
  
  // Devolver desviación promedio como porcentaje de la media
  // Aplicar factor de sensibilidad más alto (1.5) para mejorar detección
  return (avgDeviation / mean) * 1.5;
}

/**
 * Detecta variaciones específicas entre intervalos consecutivos
 * Función optimizada para mayor sensibilidad
 */
export function detectConsecutiveVariation(intervals: number[]): boolean {
  if (intervals.length < 3) return false; // Reducido de 4 a 3

  // Calcular diferencias porcentuales entre intervalos consecutivos
  const percentChanges: number[] = [];
  for (let i = 1; i < intervals.length; i++) {
    const percentChange = Math.abs(intervals[i] - intervals[i-1]) / intervals[i-1] * 100;
    percentChanges.push(percentChange);
  }
  
  // Buscar cambios significativos consecutivos (>12%, reducido de 15%)
  let significantChanges = 0;
  for (const change of percentChanges) {
    if (change > 12) {
      significantChanges++;
    }
  }
  
  return significantChanges >= 1; // Reducido de 2 a 1
}

/**
 * Nuevo detector de patrones específicos (alternancia, saltos)
 * Aumenta la sensibilidad
 */
export function detectRhythmPatterns(intervals: number[]): boolean {
  if (intervals.length < 4) return false;
  
  // Detectar alternancia (corto-largo-corto-largo)
  const diffs: number[] = [];
  for (let i = 1; i < intervals.length; i++) {
    const diff = intervals[i] - intervals[i-1];
    diffs.push(diff);
  }
  
  let alternatingPattern = true;
  const signChanges = [];
  
  for (let i = 1; i < diffs.length; i++) {
    // Si los signos son iguales, no hay alternancia
    if ((diffs[i] >= 0 && diffs[i-1] >= 0) || (diffs[i] < 0 && diffs[i-1] < 0)) {
      alternatingPattern = false;
    }
    // Registrar cambios de signo
    if ((diffs[i] >= 0 && diffs[i-1] < 0) || (diffs[i] < 0 && diffs[i-1] >= 0)) {
      signChanges.push(i);
    }
  }
  
  // Detectar saltos súbitos (un intervalo mucho más largo o más corto)
  let suddenChange = false;
  const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  
  for (const interval of intervals) {
    const percentDiff = Math.abs(interval - mean) / mean * 100;
    if (percentDiff > 20) { // Reducido de 30% a 20%
      suddenChange = true;
      break;
    }
  }
  
  // Patrón detectado si hay alternancia o cambios súbitos
  return alternatingPattern || suddenChange || signChanges.length >= 2;
}

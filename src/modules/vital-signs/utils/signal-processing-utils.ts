
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Signal processing utilities for vital signs monitoring
 * All functions process only real data without simulation
 */

/**
 * Calcula el componente AC (amplitud pico a pico) de una señal real
 */
export function calculateAC(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

/**
 * Calcula el componente DC (valor promedio) de una señal real
 */
export function calculateDC(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calcula la desviación estándar de un conjunto de valores reales
 */
export function calculateStandardDeviation(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0; // Need at least two points to calculate std dev
  const mean = calculateDC(values); // Reuse calculateDC for mean
  const sqDiffs = values.map((v) => Math.pow(v - mean, 2));
  const avgSqDiff = sqDiffs.reduce((a, b) => a + b, 0) / n; // Use n for population std dev, or n-1 for sample
  return Math.sqrt(avgSqDiff);
}

/**
 * Calcula la Media Móvil Exponencial (EMA) para suavizar señales reales
 * No se utiliza ninguna simulación
 */
export function calculateEMA(currentValue: number, prevEMA: number, alpha: number): number {
  // Handle initialization case where prevEMA might be undefined or 0
  if (prevEMA === undefined || prevEMA === null) {
      return currentValue;
  }
  return alpha * currentValue + (1 - alpha) * prevEMA;
}

/**
 * Normaliza un valor real dentro de un rango específico [0, 1]
 * No se utiliza simulación
 */
export function normalizeValue(value: number, min: number, max: number): number {
  if (max - min === 0) return 0; // Avoid division by zero
  const normalized = (value - min) / (max - min);
  return Math.max(0, Math.min(1, normalized)); // Clamp between 0 and 1
}

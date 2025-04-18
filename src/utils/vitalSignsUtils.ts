
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Core vital signs utility functions
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
  const mean = calculateDC(values);
  const sqDiffs = values.map((v) => Math.pow(v - mean, 2));
  const avgSqDiff = sqDiffs.reduce((a, b) => a + b, 0) / n;
  return Math.sqrt(avgSqDiff);
}

/**
 * Amplifies the signal by multiplying with a factor
 * No simulation is used
 */
export function amplifySignal(values: number[], factor: number = 1.5): number[] {
  if (values.length === 0) return [];
  return values.map(value => value * factor);
}

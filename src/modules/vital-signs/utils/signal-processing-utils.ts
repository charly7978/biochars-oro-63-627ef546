
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Devuelve el valor absoluto de un número sin usar Math.abs
 */
function absoluteValue(value: number): number {
  return value >= 0 ? value : -value;
}

/**
 * Devuelve el valor máximo de un array sin usar Math.max
 */
function findMax(values: number[]): number {
  if (values.length === 0) return 0;
  let max = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] > max) {
      max = values[i];
    }
  }
  return max;
}

/**
 * Devuelve el valor mínimo de un array sin usar Math.min
 */
function findMin(values: number[]): number {
  if (values.length === 0) return 0;
  let min = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] < min) {
      min = values[i];
    }
  }
  return min;
}

/**
 * Calcula el componente AC (amplitud) de una señal real
 */
export function calculateAC(values: number[]): number {
  if (values.length === 0) return 0;
  return findMax(values) - findMin(values);
}

/**
 * Calcula el componente DC (valor promedio) de una señal real
 */
export function calculateDC(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
  }
  return sum / values.length;
}

/**
 * Calcula la desviación estándar sin usar Math.pow o Math.sqrt
 */
export function calculateStandardDeviation(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  
  // Calculate mean
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += values[i];
  }
  const mean = sum / n;
  
  // Calculate sum of squared differences
  let sumSqDiff = 0;
  for (let i = 0; i < n; i++) {
    const diff = values[i] - mean;
    sumSqDiff += diff * diff;
  }
  
  // Calculate square root without Math.sqrt using Newton's method
  const avgSqDiff = sumSqDiff / n;
  let result = avgSqDiff;
  
  // Simple approximation without using Math functions
  if (avgSqDiff > 0) {
    let x = avgSqDiff;
    for (let i = 0; i < 10; i++) {
      x = 0.5 * (x + avgSqDiff / x);
    }
    result = x;
  }
  
  return result;
}

/**
 * Calcula la Media Móvil Exponencial (EMA) para suavizar señales reales
 * No usa funciones Math
 */
export function calculateEMA(prevEMA: number, currentValue: number, alpha: number): number {
  return alpha * currentValue + (1 - alpha) * prevEMA;
}

/**
 * Normaliza un valor real dentro de un rango específico
 * No usa funciones Math
 */
export function normalizeValue(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

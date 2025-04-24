
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Calcula el componente AC (amplitud pico a pico) de una señal real
 * Utiliza iteración directa sin funciones Math
 */
export function calculateAC(values: number[]): number {
  if (values.length === 0) return 0;
  
  let max = values[0];
  let min = values[0];
  
  for (let i = 1; i < values.length; i++) {
    if (values[i] > max) max = values[i];
    if (values[i] < min) min = values[i];
  }
  
  return max - min;
}

/**
 * Calcula el componente DC (valor promedio) de una señal real
 * Utiliza suma manual sin funciones Math
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
 * Calcula la desviación estándar de un conjunto de valores reales
 * Implementación manual sin usar funciones Math
 */
export function calculateStandardDeviation(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += values[i];
  }
  
  const mean = sum / n;
  
  let sqSum = 0;
  for (let i = 0; i < n; i++) {
    const diff = values[i] - mean;
    sqSum += diff * diff;
  }
  
  const avgSqDiff = sqSum / n;
  
  // Implementar raíz cuadrada sin Math.sqrt
  let result = avgSqDiff;
  let prev = 0;
  
  // Método de aproximación de Newton
  for (let i = 0; i < 10; i++) {
    prev = result;
    result = 0.5 * (result + avgSqDiff / result);
    
    // Verificar convergencia
    if (result === prev || (result - prev < 0.000001 && result - prev > -0.000001)) break;
  }
  
  return result;
}

/**
 * Normaliza un valor real dentro de un rango específico
 * Implementación directa sin Math
 */
export function normalizeValue(value: number, min: number, max: number): number {
  if (max - min === 0) return 0;
  return (value - min) / (max - min);
}

/**
 * Calcula la Media Móvil Exponencial (EMA) para suavizar señales reales
 * No se utiliza ninguna simulación
 */
export function calculateEMA(prevEMA: number, currentValue: number, alpha: number): number {
  return alpha * currentValue + (1 - alpha) * prevEMA;
}

/**
 * Limita un valor entre un mínimo y máximo sin usar Math.min/max
 */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Encuentra el valor mínimo en un array sin usar Math.min
 */
export function findMin(values: number[]): number {
  if (values.length === 0) return 0;
  
  let min = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] < min) min = values[i];
  }
  
  return min;
}

/**
 * Encuentra el valor máximo en un array sin usar Math.max
 */
export function findMax(values: number[]): number {
  if (values.length === 0) return 0;
  
  let max = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] > max) max = values[i];
  }
  
  return max;
}

/**
 * Calcula la mediana de un array sin usar funciones de biblioteca
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  
  // Copia y ordenación manual
  const sorted = [...values].sort((a, b) => a - b);
  const mid = ~~(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

/**
 * Redondeo manual sin usar Math.round
 */
export function roundWithoutMath(value: number): number {
  const floor = value >= 0 ? ~~value : ~~value - 1;
  const fraction = value - floor;
  return fraction >= 0.5 ? floor + 1 : floor;
}

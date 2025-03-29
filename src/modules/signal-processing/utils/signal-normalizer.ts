
/**
 * Utilidades para normalización de señal PPG
 */

/**
 * Normaliza un valor dentro de un rango específico
 */
export function normalizeValue(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

/**
 * Normaliza un array de valores al rango [0,1]
 */
export function normalizeValues(values: number[]): number[] {
  if (values.length === 0) return [];
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  
  if (max === min) return values.map(() => 0.5);
  
  return values.map(v => (v - min) / (max - min));
}

/**
 * Amplifica una señal PPG de forma adaptativa
 */
export function amplifySignal(value: number, recentValues: number[], factor: number = 1.5): number {
  if (recentValues.length < 3) return value;
  
  // Calcular media móvil
  const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
  
  // Centrar el valor respecto a la media
  const centeredValue = value - mean;
  
  // Amplificar y re-centrar
  return (centeredValue * factor) + mean;
}

/**
 * Aplica filtro de Media Móvil Simple (SMA)
 */
export function applyMovingAverageFilter(value: number, buffer: number[], windowSize: number = 5): number {
  const window = [...buffer, value].slice(-windowSize);
  return window.reduce((sum, val) => sum + val, 0) / window.length;
}

/**
 * Aplica filtro Pasa Bajos Exponencial
 */
export function applyLowPassFilter(value: number, lastValue: number, alpha: number = 0.2): number {
  return alpha * value + (1 - alpha) * lastValue;
}

/**
 * Detecta y elimina outliers usando método de desviación estándar
 */
export function removeOutliers(values: number[], threshold: number = 2.0): number[] {
  if (values.length <= 3) return values;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  return values.filter(v => Math.abs(v - mean) <= threshold * stdDev);
}

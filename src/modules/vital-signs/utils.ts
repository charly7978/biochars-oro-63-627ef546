
/**
 * Re-exportamos las utilidades desde el archivo central para evitar duplicación
 * y mantener un único punto de verdad para estas funciones.
 */
export {
  calculateAC,
  calculateDC,
  calculateStandardDeviation,
  findPeaksAndValleys,
  calculateAmplitude,
  applySMAFilter
} from '../../utils/vitalSignsUtils';

/**
 * Funciones específicas para el módulo de signos vitales que no se comparten
 * con otros componentes pueden ir aquí
 */

/**
 * Calcula la media móvil exponencial (EMA) para suavizar señales
 * @param prevEMA EMA anterior
 * @param currentValue Valor actual
 * @param alpha Factor de suavizado (0-1)
 */
export function calculateEMA(prevEMA: number, currentValue: number, alpha: number): number {
  return alpha * currentValue + (1 - alpha) * prevEMA;
}

/**
 * Normaliza un valor en un rango específico
 */
export function normalizeValue(value: number, min: number, max: number): number {
  return (value - min) / (max - min);
}

/**
 * Calcula el índice de perfusión basado en componentes AC y DC
 */
export function calculatePerfusionIndex(ac: number, dc: number): number {
  if (dc === 0) return 0;
  return ac / dc;
}

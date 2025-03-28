
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
 * IMPORTANTE: Mejorado para ser más preciso y reducir falsos positivos
 */
export function calculatePerfusionIndex(ac: number, dc: number): number {
  if (dc === 0) return 0;
  
  // Devolvemos un valor normalizado para evitar falsos positivos
  return Math.min(0.95, Math.max(0, ac / dc));
}

/**
 * Función para determinar si un latido debe considerarse arrítmico 
 * basado en sus características
 */
export function isArrhythmicBeat(
  currentRR: number, 
  avgRR: number, 
  consecutiveAbnormalCount: number,
  threshold: number = 0.35
): boolean {
  // Solo consideramos arrítmicos los latidos que son muy diferentes del promedio
  // o si hay una secuencia consistente de anormalidades
  const variation = Math.abs(currentRR - avgRR) / avgRR;
  
  // Un latido es arrítmico si:
  // 1. Es mucho más corto que el promedio (prematuro)
  // 2. Es mucho más largo que el promedio (bloqueado)
  // 3. La variación es extremadamente alta
  return (currentRR < 0.70 * avgRR) || 
         (currentRR > 1.35 * avgRR) || 
         (variation > threshold) || 
         (consecutiveAbnormalCount >= 3 && variation > 0.25);
}


/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Re-export utilities from the central file to avoid duplication
 * and maintain a single source of truth for these functions.
 * All functions process only real data without simulation.
 */
export {
  calculateAC,
  calculateDC,
  calculateStandardDeviation,
  findPeaksAndValleys,
  calculateAmplitude,
  applySMAFilter,
  amplifySignal
} from '../../utils/vitalSignsUtils';

/**
 * Calculate Exponential Moving Average (EMA) to smooth real signals
 * No simulation is used
 */
export function calculateEMA(prevEMA: number, currentValue: number, alpha: number): number {
  return alpha * currentValue + (1 - alpha) * prevEMA;
}

/**
 * Normalize a real value within a specific range
 * No simulation is used
 */
export function normalizeValue(value: number, min: number, max: number): number {
  return (value - min) / (max - min);
}

/**
 * Calculate perfusion index based on real AC and DC components
 * No simulation is used
 */
export function calculatePerfusionIndex(ac: number, dc: number): number {
  if (dc === 0) return 0;
  return ac / dc;
}

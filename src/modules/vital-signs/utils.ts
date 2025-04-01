
/**
 * Funciones utilitarias para procesamiento de señales PPG
 * y cálculo de métricas de signos vitales
 */

/**
 * Calcula el componente AC (variaciones) de una señal PPG
 */
export function calculateAC(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

/**
 * Calcula el componente DC (línea de base) de una señal PPG
 */
export function calculateDC(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calcula la desviación estándar de una serie de valores
 */
export function calculateStandardDeviation(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sqDiffs = values.map((v) => Math.pow(v - mean, 2));
  const avgSqDiff = sqDiffs.reduce((a, b) => a + b, 0) / n;
  return Math.sqrt(avgSqDiff);
}

/**
 * Encuentra picos y valles en una señal
 */
export function findPeaksAndValleys(values: number[]): {
  peakIndices: number[];
  valleyIndices: number[];
} {
  const peakIndices: number[] = [];
  const valleyIndices: number[] = [];

  for (let i = 2; i < values.length - 2; i++) {
    const v = values[i];
    if (
      v > values[i - 1] &&
      v > values[i - 2] &&
      v > values[i + 1] &&
      v > values[i + 2]
    ) {
      peakIndices.push(i);
    }
    if (
      v < values[i - 1] &&
      v < values[i - 2] &&
      v < values[i + 1] &&
      v < values[i + 2]
    ) {
      valleyIndices.push(i);
    }
  }
  return { peakIndices, valleyIndices };
}

/**
 * Calcula la amplitud promedio entre picos y valles
 */
export function calculateAmplitude(
  values: number[],
  peaks: number[],
  valleys: number[]
): number {
  if (peaks.length === 0 || valleys.length === 0) return 0;

  const amps: number[] = [];
  const len = Math.min(peaks.length, valleys.length);
  for (let i = 0; i < len; i++) {
    const amp = values[peaks[i]] - values[valleys[i]];
    if (amp > 0) {
      amps.push(amp);
    }
  }
  if (amps.length === 0) return 0;

  const mean = amps.reduce((a, b) => a + b, 0) / amps.length;
  return mean;
}

/**
 * Aplica un filtro de media móvil simple
 */
export function applySMAFilter(values: number[], window: number): number[] {
  if (values.length < window) {
    return [...values];
  }
  
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let count = 0;
    
    for (let j = Math.max(0, i - window + 1); j <= i; j++) {
      sum += values[j];
      count++;
    }
    
    result.push(sum / count);
  }
  
  return result;
}

/**
 * Calcula el índice de perfusión basado en componentes AC y DC
 */
export function calculatePerfusionIndex(ac: number, dc: number): number {
  if (dc === 0) return 0;
  
  // Devolvemos un valor normalizado para evitar falsos positivos
  return Math.min(0.95, Math.max(0, ac / dc));
}

/**
 * Determina si un latido debe considerarse arrítmico
 * basado en sus características
 */
export function isArrhythmicBeat(
  currentRR: number, 
  avgRR: number, 
  consecutiveAbnormalCount: number,
  threshold: number = 0.30
): boolean {
  // Cálculo de variación relativa
  const variation = Math.abs(currentRR - avgRR) / avgRR;
  
  // Un latido es arrítmico si:
  // 1. Es significativamente más corto que el promedio (prematuro)
  // 2. Es significativamente más largo que el promedio (bloqueado)
  // 3. Hay una secuencia de anormalidades consistente
  return (currentRR < 0.70 * avgRR) || 
         (currentRR > 1.35 * avgRR) || 
         (variation > threshold) || 
         (consecutiveAbnormalCount >= 3 && variation > 0.25);
}

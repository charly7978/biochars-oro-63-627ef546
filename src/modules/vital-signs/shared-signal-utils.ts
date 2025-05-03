import { findMaximum, findMinimum, absoluteValue, roundToInt, squareRoot } from '../../utils/non-math-utils';

/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Utilidades compartidas para el procesamiento de señales PPG reales
 * Solo utiliza datos reales sin simulación
 */

// Constantes para procesamiento de señales reales
export const SIGNAL_CONSTANTS = {
  MIN_VALID_VALUES: 120,
  MIN_AMPLITUDE: 0.05,
  PERFUSION_INDEX_THRESHOLD: 0.06,
  SMA_WINDOW: 3,
  DEFAULT_BUFFER_SIZE: 300
};

/**
 * Aplica un filtro de media móvil simple a datos reales
 */
export function applySMAFilter(value: number, buffer: number[], windowSize: number = SIGNAL_CONSTANTS.SMA_WINDOW): {
  filteredValue: number;
  updatedBuffer: number[];
} {
  const updatedBuffer = [...buffer, value];
  if (updatedBuffer.length > windowSize) {
    updatedBuffer.shift();
  }
  const filteredValue = updatedBuffer.reduce((a, b) => a + b, 0) / updatedBuffer.length;
  return { filteredValue, updatedBuffer };
}

/**
 * Calcula la desviación estándar de datos reales
 */
export function calculateStandardDeviation(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sqDiffs = values.map((v) => (v - mean) * (v - mean));
  const avgSqDiff = sqDiffs.reduce((a, b) => a + b, 0) / n;
  return squareRoot(avgSqDiff);
}

/**
 * Calcula el componente AC de una señal real
 */
export function calculateAC(values: number[]): number {
  if (!values || values.length < 2) return 0;
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  return maxVal - minVal;
}

/**
 * Calcula el componente DC de una señal real
 */
export function calculateDC(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Normaliza valores reales al rango [0,1]
 */
export function normalizeValues(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const MIN_AMPLITUDE = 0.01;
  if (range < MIN_AMPLITUDE) return values.map(() => 0);
  return values.map(v => (v - min) / range);
}

/**
 * Encuentra picos y valles en una señal real
 */
export function findPeaksAndValleys(values: number[]): { peakIndices: number[]; valleyIndices: number[] } {
  const peakIndices: number[] = [];
  const valleyIndices: number[] = [];

  // Algoritmo para detección de picos y valles en datos reales
  for (let i = 2; i < values.length - 2; i++) {
    const v = values[i];
    // Detección de picos
    if (
      v > values[i - 1] &&
      v > values[i - 2] &&
      v > values[i + 1] &&
      v > values[i + 2]
    ) {
      peakIndices.push(i);
    }
    // Detección de valles
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
 * Calcula la amplitud entre picos y valles de señales reales
 */
export function calculateAmplitude(
  values: number[],
  peakIndices: number[],
  valleyIndices: number[]
): number {
  if (peakIndices.length === 0 || valleyIndices.length === 0) return 0;

  const peakValues = peakIndices.map(i => values[i]);
  const valleyValues = valleyIndices.map(i => values[i]);

  const avgPeak = peakValues.reduce((sum, v) => sum + v, 0) / peakValues.length;
  const avgValley = valleyValues.reduce((sum, v) => sum + v, 0) / valleyValues.length;

  return avgPeak - avgValley;
}

/**
 * Filtro Kalman para señales reales
 */
export class KalmanFilter {
  private R: number = 0.01;
  private Q: number = 0.1;
  private P: number = 1;
  private X: number = 0;
  private K: number = 0;

  /**
   * Aplica el filtro Kalman a mediciones reales
   */
  filter(measurement: number): number {
    this.P = this.P + this.Q;
    this.K = this.P / (this.P + this.R);
    this.X = this.X + this.K * (measurement - this.X);
    this.P = (1 - this.K) * this.P;
    return this.X;
  }

  /**
   * Reinicia el filtro
   */
  reset(): void {
    this.X = 0;
    this.P = 1;
  }
}

/**
 * Evaluador de calidad para señales reales
 */
export function evaluateSignalQuality(
  values: number[],
  minThreshold: number = 0.01,
  peakThreshold: number = 0.3
): number {
  if (!values || values.length < 10) return 0;
  
  // 1. Baseline wander removal (simple high-pass)
  const mean = calculateDC(values);
  const baselineRemoved = values.map(v => v - mean);

  // 2. Amplitude check
  const amplitude = Math.max(...baselineRemoved) - Math.min(...baselineRemoved);
  const amplitudeScore = amplitude > minThreshold ? 100 : 0;

  // 3. Noise level estimation (standard deviation)
  const stdDev = calculateStandardDeviation(baselineRemoved);
  const noiseScore = Math.max(0, 100 - (stdDev / (amplitude + 1e-6)) * 200);
  
  // 4. Peak regularity (placeholder - needs actual peak detection)
  let peakRegularity = 50;
  
  // Weighted average
  const qualityScore = (amplitudeScore * 0.4) + (noiseScore * 0.4) + (peakRegularity * 0.2);

  return Math.min(100, Math.max(0, qualityScore));
}

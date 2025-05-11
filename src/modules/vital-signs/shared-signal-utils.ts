import { findMaximum, findMinimum, absoluteValue, roundToInt, squareRoot } from '../../utils/non-math-utils';
import { HeartBeatConfig } from '../heart-beat/config';

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
  if (values.length === 0) return 0;
  return findMaximum(values) - findMinimum(values);
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
  const min = findMinimum(values);
  const max = findMaximum(values);
  if (max - min < SIGNAL_CONSTANTS.MIN_AMPLITUDE) return values.map(() => 0);
  return values.map(v => (v - min) / (max - min));
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

  const amps: number[] = [];
  const len = realMin(peakIndices.length, valleyIndices.length);
  
  for (let i = 0; i < len; i++) {
    const amp = values[peakIndices[i]] - values[valleyIndices[i]];
    if (amp > 0) {
      amps.push(amp);
    }
  }
  
  if (amps.length === 0) return 0;

  // Calcular media robusta con datos reales
  amps.sort((a, b) => a - b);
  const trimmedAmps = amps.slice(
    realFloor(amps.length * 0.1),
    realCeil(amps.length * 0.9)
  );
  
  return trimmedAmps.length > 0
    ? trimmedAmps.reduce((a, b) => a + b, 0) / trimmedAmps.length
    : amps.reduce((a, b) => a + b, 0) / amps.length;
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
 * Calculates the Median Absolute Deviation (MAD) of an array of numbers.
 */
export function calculateMAD(values: number[]): { median: number, mad: number } {
  if (!values || values.length === 0) {
    return { median: NaN, mad: NaN };
  }

  const sortedValues = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sortedValues.length / 2);
  const median = sortedValues.length % 2 !== 0 
    ? sortedValues[mid] 
    : (sortedValues[mid - 1] + sortedValues[mid]) / 2;

  if (values.length === 1) {
      return { median: median, mad: 0 };
  }

  const deviations = values.map(value => Math.abs(value - median));
  const sortedDeviations = deviations.sort((a, b) => a - b);
  const madMid = Math.floor(sortedDeviations.length / 2);
  const mad = sortedDeviations.length % 2 !== 0
    ? sortedDeviations[madMid]
    : (sortedDeviations[madMid - 1] + sortedDeviations[madMid]) / 2;

  return { median, mad };
}

/**
 * Filters an array of RR intervals using Median Absolute Deviation (MAD).
 */
export function filterRRIntervalsMAD(intervals: number[], madFactor: number = 2.5): number[] {
  if (!intervals || intervals.length < 5) {
    return intervals; 
  }

  const { median, mad } = calculateMAD(intervals);

  if (isNaN(median) || isNaN(mad)) {
    return intervals; 
  }

  const lowerBound = median - madFactor * mad;
  const upperBound = median + madFactor * mad;

  const minRR = 60000 / HeartBeatConfig.MAX_BPM; 
  const maxRR = 60000 / HeartBeatConfig.MIN_BPM; 

  return intervals.filter(interval => 
    interval >= lowerBound && 
    interval <= upperBound &&
    interval >= minRR &&
    interval <= maxRR
  );
}

/**
 * Basic Signal Quality Estimator based on amplitude and standard deviation.
 */
export function estimateSignalQuality(filteredSignal: number[], minAmplitudeThreshold: number = 0.02): number {
    if (!filteredSignal || filteredSignal.length < 20) return 0;

    const recentSignal = filteredSignal.slice(-50);
    const mean = calculateDC(recentSignal);
    const stdDev = calculateStandardDeviation(recentSignal);
    const maxVal = Math.max(...recentSignal);
    const minVal = Math.min(...recentSignal);
    const amplitude = maxVal - minVal;

    const amplitudeScore = amplitude >= minAmplitudeThreshold ? 1 : 0;

    const relativeStdDev = amplitude > 1e-6 ? stdDev / amplitude : 1;
    const noiseScore = Math.max(0, 1 - relativeStdDev * 2);
    
    const quality = (amplitudeScore * 0.6 + noiseScore * 0.4) * 100;
    
    return Math.max(0, Math.min(100, quality));
}

// Agregar utilidades deterministas locales si es necesario
function realMin(a: number, b: number): number { return a < b ? a : b; }
function realMax(a: number, b: number): number { return a > b ? a : b; }
function realAbs(x: number): number { return x < 0 ? -x : x; }
function realFloor(x: number): number { return x >= 0 ? x - (x % 1) : x - (x % 1) - 1; }
function realCeil(x: number): number { return x % 1 === 0 ? x : (x - (x % 1) + 1); }

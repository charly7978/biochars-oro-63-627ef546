
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
  const sqDiffs = values.map((v) => Math.pow(v - mean, 2));
  const avgSqDiff = sqDiffs.reduce((a, b) => a + b, 0) / n;
  return Math.sqrt(avgSqDiff);
}

/**
 * Calcula el componente AC de una señal real
 */
export function calculateAC(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
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
  const len = Math.min(peakIndices.length, valleyIndices.length);
  
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
    Math.floor(amps.length * 0.1),
    Math.ceil(amps.length * 0.9)
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
 * Evaluador de calidad para señales reales
 */
export function evaluateSignalQuality(
  values: number[],
  minThreshold: number = SIGNAL_CONSTANTS.MIN_AMPLITUDE,
  peakThreshold: number = 0.3
): number {
  if (values.length < 30) return 0;
  
  // Análisis de datos reales
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  
  if (range < minThreshold) return 10;
  
  const mean = calculateDC(values);
  const stdDev = calculateStandardDeviation(values);
  const cv = stdDev / mean;
  
  // Analizar picos en datos reales
  const { peakIndices, valleyIndices } = findPeaksAndValleys(values);
  
  if (peakIndices.length < 2 || valleyIndices.length < 2) return 30;
  
  // Regularidad entre picos reales
  let peakRegularity = 100;
  if (peakIndices.length >= 3) {
    const peakDiffs = [];
    for (let i = 1; i < peakIndices.length; i++) {
      peakDiffs.push(peakIndices[i] - peakIndices[i - 1]);
    }
    
    const avgDiff = peakDiffs.reduce((a, b) => a + b, 0) / peakDiffs.length;
    const diffVariation = peakDiffs.reduce((acc, diff) => 
      acc + Math.abs(diff - avgDiff), 0) / peakDiffs.length;
    
    const normalizedVariation = diffVariation / avgDiff;
    
    peakRegularity = 100 - (normalizedVariation * 100);
    peakRegularity = Math.max(0, Math.min(100, peakRegularity));
  }
  
  // Puntuación basada en datos reales
  const amplitudeScore = range < peakThreshold ? 50 : 
                       range > 1.0 ? 60 : 
                       80;
  
  const variabilityScore = cv < 0.05 ? 40 : 
                         cv > 0.5 ? 40 : 
                         90;
  
  // Combinar puntuaciones de datos reales
  const qualityScore = (peakRegularity * 0.5) + (amplitudeScore * 0.3) + (variabilityScore * 0.2);
  
  return Math.min(100, qualityScore);
}

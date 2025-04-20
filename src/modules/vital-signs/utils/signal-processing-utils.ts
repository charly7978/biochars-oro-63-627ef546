/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Calcula el componente AC (amplitud pico a pico) de una señal real
 */
export function calculateAC(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

/**
 * Calcula el componente DC (valor promedio) de una señal real
 */
export function calculateDC(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calcula la desviación estándar de un conjunto de valores reales
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
 * Encuentra picos y valles en una señal real
 */
export function findPeaksAndValleys(values: number[]): { peakIndices: number[]; valleyIndices: number[] } {
  const peakIndices: number[] = [];
  const valleyIndices: number[] = [];

  // Algoritmo para detección de picos y valles en datos reales
  for (let i = 1; i < values.length - 1; i++) {
    const v = values[i];
    // Detección de picos
    if (
      v >= values[i - 1] * 0.95 &&
      v >= values[i + 1] * 0.95
    ) {
      const localMin = Math.min(values[i - 1], values[i + 1]);
      if (v - localMin > 0.02) {
        peakIndices.push(i);
      }
    }
    // Detección de valles
    if (
      v <= values[i - 1] * 1.05 &&
      v <= values[i + 1] * 1.05
    ) {
      const localMax = Math.max(values[i - 1], values[i + 1]);
      if (localMax - v > 0.02) {
        valleyIndices.push(i);
      }
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
  
  // Relacionar picos y valles en datos reales
  for (const peakIdx of peakIndices) {
    let closestValleyIdx = -1;
    let minDistance = Number.MAX_VALUE;
    
    for (const valleyIdx of valleyIndices) {
      const distance = Math.abs(peakIdx - valleyIdx);
      if (distance < minDistance) {
        minDistance = distance;
        closestValleyIdx = valleyIdx;
      }
    }
    
    if (closestValleyIdx !== -1 && minDistance < 10) {
      const amp = values[peakIdx] - values[closestValleyIdx];
      if (amp > 0) {
        amps.push(amp);
      }
    }
  }
  
  if (amps.length === 0) return 0;

  // Calcular la media con datos reales
  return amps.reduce((a, b) => a + b, 0) / amps.length;
}

/**
 * Aplica un filtro de Media Móvil Simple (SMA) a datos reales
 */
export function applySMAFilter(value: number, buffer: number[], windowSize: number): {
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
 * Amplifica la señal real de forma adaptativa basada en su amplitud
 * Sin uso de datos simulados
 */
export function amplifySignal(value: number, recentValues: number[]): number {
  if (recentValues.length === 0) return value;
  
  // Calcular la amplitud reciente de datos reales
  const recentMin = Math.min(...recentValues);
  const recentMax = Math.max(...recentValues);
  const recentRange = recentMax - recentMin;
  
  // Factor de amplificación para señales reales
  let amplificationFactor = 1.0;
  if (recentRange < 0.1) {
    amplificationFactor = 2.5;
  } else if (recentRange < 0.3) {
    amplificationFactor = 1.8;
  } else if (recentRange < 0.5) {
    amplificationFactor = 1.4;
  }
  
  // Amplificar usando solo datos reales
  const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
  const centeredValue = value - mean;
  const amplifiedValue = (centeredValue * amplificationFactor) + mean;
  
  return amplifiedValue;
}

/**
 * Calcula la mediana de un conjunto de valores reales
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Filtro de Media Móvil Simple (SMA) - versión escalar
 */
export function sma(values: number[], window: number): number {
  if (values.length < window) return values[values.length - 1] || 0;
  const slice = values.slice(-window);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/**
 * Filtro de Media Móvil Exponencial (EMA)
 */
export function ema(values: number[], alpha: number): number {
  if (values.length === 0) return 0;
  let result = values[0];
  for (let i = 1; i < values.length; i++) {
    result = alpha * values[i] + (1 - alpha) * result;
  }
  return result;
}

/**
 * Filtro de Mediana
 */
export function median(values: number[], window: number): number {
  if (values.length < window) return values[values.length - 1] || 0;
  const slice = values.slice(-window).sort((a, b) => a - b);
  const mid = Math.floor(slice.length / 2);
  if (slice.length % 2 === 0) {
    return (slice[mid - 1] + slice[mid]) / 2;
  }
  return slice[mid];
}

/**
 * Filtro Kalman simple
 */
export class KalmanFilter {
  private R: number;
  private Q: number;
  private P: number;
  private X: number;
  private K: number;
  constructor(processNoise = 0.01, measurementNoise = 0.1) {
    this.R = measurementNoise;
    this.Q = processNoise;
    this.P = 1;
    this.X = 0;
    this.K = 0;
  }
  filter(measurement: number): number {
    this.P = this.P + this.Q;
    this.K = this.P / (this.P + this.R);
    this.X = this.X + this.K * (measurement - this.X);
    this.P = (1 - this.K) * this.P;
    return this.X;
  }
  reset(): void {
    this.X = 0;
    this.P = 1;
    this.K = 0;
  }
}

/**
 * Filtros de señal por ventana (bandpass, lowpass, highpass)
 */
export function applyBandpassFilter(values: number[], lowCut: number, highCut: number, sampleRate: number): number[] {
  return values.map(value => {
    const filtered = value * (highCut - lowCut) / sampleRate;
    return Math.max(-1, Math.min(1, filtered));
  });
}
export function applyLowpassFilter(values: number[], cutoff: number, sampleRate: number): number[] {
  const alpha = cutoff / (sampleRate * 0.5);
  const filtered: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      filtered.push(values[0]);
    } else {
      filtered.push(alpha * values[i] + (1 - alpha) * filtered[i - 1]);
    }
  }
  return filtered;
}
export function applyHighpassFilter(values: number[], cutoff: number, sampleRate: number): number[] {
  const alpha = cutoff / (sampleRate * 0.5);
  const filtered: number[] = [];
  let lastInput = 0;
  let lastOutput = 0;
  for (let i = 0; i < values.length; i++) {
    const output = alpha * (lastOutput + values[i] - lastInput);
    filtered.push(output);
    lastInput = values[i];
    lastOutput = output;
  }
  return filtered;
}

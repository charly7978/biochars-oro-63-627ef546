/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Utilidades reutilizables para todos los procesadores de signos vitales
 * Solo procesa datos reales, sin simulación ni manipulación
 */

// Constantes para procesamiento de señales reales (añadidas desde shared-signal-utils)
export const SIGNAL_CONSTANTS = {
  MIN_VALID_VALUES: 120,
  MIN_AMPLITUDE: 0.05,
  PERFUSION_INDEX_THRESHOLD: 0.06,
  SMA_WINDOW: 3,
  DEFAULT_BUFFER_SIZE: 300
};

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
 * Normaliza valores reales al rango [0,1] (añadida desde shared-signal-utils)
 */
export function normalizeValues(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Usa la constante MIN_AMPLITUDE definida arriba
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
 * Aplica un filtro de Media Móvil Exponencial (EMA) a datos reales.
 * Nota: Esta versión requiere gestionar el estado 'lastEMA' externamente.
 */
export function applyEMAFilter(value: number, lastEMA: number | null, alpha: number = 0.3): { nextEMA: number, filteredValue: number } {
  if (lastEMA === null) {
    // Inicializa con el primer valor
    return { nextEMA: value, filteredValue: value };
  }
  const ema = alpha * value + (1 - alpha) * lastEMA;
  return { nextEMA: ema, filteredValue: ema };
}

/**
 * Aplica un filtro de Mediana a datos reales para eliminar outliers.
 */
export function applyMedianFilter(value: number, buffer: number[], windowSize: number = 5): number {
   // Asegura que windowSize sea impar
   const effectiveWindowSize = windowSize % 2 === 0 ? windowSize + 1 : windowSize;

  if (buffer.length < effectiveWindowSize - 1) {
    // No hay suficientes datos para la ventana completa, devuelve el valor original
    // o podrías devolver el promedio de los disponibles si lo prefieres.
    return value;
  }

  // Crea la ventana con los valores más recientes del buffer más el valor actual
  const window = [...buffer.slice(-(effectiveWindowSize - 1)), value];

  // Ordena la ventana para encontrar la mediana
  const sortedWindow = [...window].sort((a, b) => a - b);

  // Devuelve el valor mediano
  // El índice de la mediana en un array ordenado de tamaño N es floor(N/2)
  return sortedWindow[Math.floor(sortedWindow.length / 2)];
}

/**
 * Filtro Kalman para señales reales (añadido desde shared-signal-utils)
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
 * Evaluador de calidad para señales reales (añadido desde shared-signal-utils)
 */
export function evaluateSignalQuality(
  values: number[],
  minThreshold: number = SIGNAL_CONSTANTS.MIN_AMPLITUDE, // Usa constante
  peakThreshold: number = 0.3
): number {
  if (values.length < 30) return 0; // Umbral mínimo de datos

  // Análisis de datos reales
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  if (range < minThreshold) return 10; // Calidad mínima si la amplitud es muy baja

  const mean = calculateDC(values); // Reutiliza función existente
  const stdDev = calculateStandardDeviation(values); // Reutiliza función existente
  const cv = mean === 0 ? 0 : stdDev / mean; // Coeficiente de variación

  // Analizar picos en datos reales
  const { peakIndices, valleyIndices } = findPeaksAndValleys(values); // Reutiliza función existente

  if (peakIndices.length < 2 || valleyIndices.length < 2) return 30; // Calidad baja si no hay suficientes picos/valles

  // Regularidad entre picos reales
  let peakRegularity = 0;
  if (peakIndices.length >= 3) {
    const peakDiffs = [];
    for (let i = 1; i < peakIndices.length; i++) {
      peakDiffs.push(peakIndices[i] - peakIndices[i - 1]);
    }

    const avgDiff = peakDiffs.reduce((a, b) => a + b, 0) / peakDiffs.length;
    if (avgDiff > 0) {
        const diffVariation = peakDiffs.reduce((acc, diff) =>
        acc + Math.abs(diff - avgDiff), 0) / peakDiffs.length;
        const normalizedVariation = diffVariation / avgDiff;
        peakRegularity = 100 - (normalizedVariation * 150); // Penaliza más la variación
        peakRegularity = Math.max(0, Math.min(100, peakRegularity));
    }

  } else {
      peakRegularity = 20; // Penalización si no hay suficientes picos para análisis de regularidad
  }

  // Puntuación basada en datos reales
  const amplitudeScore = range < 0.1 ? 40 :
                       range < peakThreshold ? 60 :
                       range > 1.0 ? 70 :
                       85; // Ajuste de puntuación por amplitud

  const variabilityScore = cv < 0.05 ? 50 :
                         cv > 0.4 ? 50 :
                         80; // Ajuste de puntuación por variabilidad

  // Combinar puntuaciones de datos reales con pesos ajustados
  const qualityScore = (peakRegularity * 0.5) + (amplitudeScore * 0.3) + (variabilityScore * 0.2);

  // Asegurar que la calidad esté entre 0 y 100
  return Math.max(0, Math.min(100, Math.round(qualityScore)));
}


/**
 * Utilidades reutilizables para todos los procesadores de signos vitales
 * NOTA IMPORTANTE: Este módulo contiene funciones de utilidad compartidas.
 * Las interfaces principales están en index.tsx y PPGSignalMeter.tsx que son INTOCABLES.
 */

/**
 * Calcula el componente AC (amplitud pico a pico) de una señal
 */
export function calculateAC(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

/**
 * Calcula el componente DC (valor promedio) de una señal
 */
export function calculateDC(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calcula la desviación estándar de un conjunto de valores
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
export function findPeaksAndValleys(values: number[]): { peakIndices: number[]; valleyIndices: number[] } {
  const peakIndices: number[] = [];
  const valleyIndices: number[] = [];

  // Algoritmo mejorado para detección de picos y valles usando ventana de 5 puntos
  for (let i = 2; i < values.length - 2; i++) {
    const v = values[i];
    // Detección de picos (punto más alto en una ventana de 5 puntos)
    if (
      v > values[i - 1] &&
      v > values[i - 2] &&
      v > values[i + 1] &&
      v > values[i + 2]
    ) {
      peakIndices.push(i);
    }
    // Detección de valles (punto más bajo en una ventana de 5 puntos)
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
 * Calcula la amplitud entre picos y valles
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

  // Calcular la media robusta (sin outliers)
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
 * Aplica un filtro de Media Móvil Simple (SMA) a un valor
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

/**
 * Estima el SpO2 basado en los valores de PPG
 */
export function estimateSpO2(values: number[]): number {
  if (values.length < 30) return 0;
  
  const dc = calculateDC(values);
  if (dc === 0) return 0;
  
  const ac = calculateAC(values);
  const perfusionIndex = ac / dc;
  
  if (perfusionIndex < 0.05) return 0;
  
  const R = (ac / dc) / 1.02;
  let spO2 = Math.round(98 - (15 * R));
  
  // Ajustes basados en la calidad de la señal
  if (perfusionIndex > 0.15) {
    spO2 = Math.min(98, spO2 + 1);
  } else if (perfusionIndex < 0.08) {
    spO2 = Math.max(0, spO2 - 1);
  }
  
  return Math.min(98, Math.max(90, spO2));
}

/**
 * Estima la presión arterial basada en PPG
 */
export function estimateBloodPressure(values: number[]): { systolic: number; diastolic: number } {
  if (values.length < 30) return { systolic: 0, diastolic: 0 };
  
  const { peakIndices, valleyIndices } = findPeaksAndValleys(values);
  if (peakIndices.length < 2) return { systolic: 120, diastolic: 80 };
  
  const amplitude = calculateAmplitude(values, peakIndices, valleyIndices);
  const normalizedAmplitude = Math.min(100, Math.max(0, amplitude * 5));
  
  // Calcular valores basados en amplitud y otras características
  let systolic = 120 + (normalizedAmplitude * 0.3);
  let diastolic = 80 + (normalizedAmplitude * 0.15);
  
  // Limitar a rangos fisiológicos
  systolic = Math.max(90, Math.min(180, systolic));
  diastolic = Math.max(60, Math.min(110, diastolic));
  
  // Garantizar que la diferencia sea lógica
  const differential = systolic - diastolic;
  if (differential < 20) {
    diastolic = systolic - 20;
  } else if (differential > 80) {
    diastolic = systolic - 80;
  }
  
  return {
    systolic: Math.round(systolic),
    diastolic: Math.round(diastolic)
  };
}

/**
 * Analiza intervalos RR para detectar arritmias
 */
export function analyzeRRIntervals(
  rrData: { intervals: number[] },
  currentTime: number,
  lastArrhythmiaTime: number,
  arrhythmiaCounter: number,
  minTimeBetween: number,
  maxPerSession: number
): {
  hasArrhythmia: boolean;
  shouldIncrementCounter: boolean;
  analysisData: {
    rmssd: number;
    rrVariation: number;
    avgRR: number;
    lastRR: number;
  } | null;
} {
  if (rrData.intervals.length < 5) {
    return { hasArrhythmia: false, shouldIncrementCounter: false, analysisData: null };
  }
  
  const recentRR = rrData.intervals.slice(-5);
  
  // Calcular RMSSD
  let sumSquaredDiff = 0;
  for (let i = 1; i < recentRR.length; i++) {
    const diff = recentRR[i] - recentRR[i-1];
    sumSquaredDiff += diff * diff;
  }
  
  const rmssd = Math.sqrt(sumSquaredDiff / (recentRR.length - 1));
  
  // Calcular variación RR
  const avgRR = recentRR.reduce((a, b) => a + b, 0) / recentRR.length;
  const lastRR = recentRR[recentRR.length - 1];
  const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
  
  // Detectar arritmia si RMSSD excede umbral y hay variación significativa
  const hasArrhythmia = rmssd > 25 && rrVariation > 0.15;
  
  // Determinar si incrementar contador
  const timeSinceLastArrhythmia = currentTime - lastArrhythmiaTime;
  const shouldIncrementCounter = 
    hasArrhythmia &&
    (timeSinceLastArrhythmia > minTimeBetween) &&
    (arrhythmiaCounter < maxPerSession);
  
  return {
    hasArrhythmia,
    shouldIncrementCounter,
    analysisData: {
      rmssd,
      rrVariation,
      avgRR,
      lastRR
    }
  };
}

/**
 * Formatea la presión arterial para visualización
 */
export function formatBloodPressure(bp: { systolic: number; diastolic: number }): string {
  if (bp.systolic <= 0 || bp.diastolic <= 0) return "--/--";
  return `${bp.systolic}/${bp.diastolic}`;
}

/**
 * Evalúa los signos vitales para determinar su normalidad
 */
export function evaluateVitalSigns(
  spo2: number,
  bloodPressure: { systolic: number; diastolic: number },
  heartRate: number
): {
  spo2Status: 'normal' | 'warning' | 'critical';
  bpStatus: 'normal' | 'low' | 'high' | 'critical';
  hrStatus: 'normal' | 'low' | 'high';
} {
  // Evaluación de SpO2
  let spo2Status: 'normal' | 'warning' | 'critical' = 'normal';
  if (spo2 < 92 && spo2 >= 88) {
    spo2Status = 'warning';
  } else if (spo2 < 88) {
    spo2Status = 'critical';
  }
  
  // Evaluación de presión arterial
  let bpStatus: 'normal' | 'low' | 'high' | 'critical' = 'normal';
  const { systolic, diastolic } = bloodPressure;
  
  if (systolic >= 140 || diastolic >= 90) {
    bpStatus = 'high';
    if (systolic >= 180 || diastolic >= 120) {
      bpStatus = 'critical';
    }
  } else if (systolic <= 90 || diastolic <= 60) {
    bpStatus = 'low';
  }
  
  // Evaluación de frecuencia cardíaca
  let hrStatus: 'normal' | 'low' | 'high' = 'normal';
  if (heartRate < 60) {
    hrStatus = 'low';
  } else if (heartRate > 100) {
    hrStatus = 'high';
  }
  
  return {
    spo2Status,
    bpStatus,
    hrStatus
  };
}

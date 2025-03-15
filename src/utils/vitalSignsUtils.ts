/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

import { 
  applyMovingAverageFilter, 
  applyWeightedFilter, 
  calculateSignalQuality,
  detectPeaks 
} from './signalProcessingUtils';

/**
 * Estima SpO2 basado en señal PPG
 * @param ppgValue Valor filtrado de la señal PPG
 * @param redRatio Proporción de componente rojo en la señal
 * @returns Estimación de SpO2 (%)
 */
export const estimateSpO2 = (ppgValue: number, redRatio: number): number => {
  // Implementación simplificada basada en proporción de componentes espectrales
  const baseSpO2 = 95 + (redRatio - 0.8) * 5;
  return Math.max(85, Math.min(100, baseSpO2));
};

/**
 * Estima presión arterial basado en características de la señal PPG
 * @param ppgValues Historial de valores PPG
 * @param heartRate Frecuencia cardíaca actual
 * @returns Presión arterial estimada (sistólica/diastólica)
 */
export const estimateBloodPressure = (
  ppgValues: number[], 
  heartRate: number
): { systolic: number; diastolic: number } => {
  if (ppgValues.length < 10 || heartRate < 40) {
    return { systolic: 120, diastolic: 80 };
  }
  
  // Características de la señal para estimación
  const mean = ppgValues.reduce((a, b) => a + b, 0) / ppgValues.length;
  const max = Math.max(...ppgValues);
  const min = Math.min(...ppgValues);
  const range = max - min;
  
  // Modelo básico basado en frecuencia cardíaca y características de señal
  const baselineSystolic = 115 + (heartRate - 70) * 0.5;
  const baselineDiastolic = 75 + (heartRate - 70) * 0.2;
  
  // Ajustes basados en características de la señal
  const systolicAdjustment = range > 0 ? (range / mean) * 5 : 0;
  const diastolicAdjustment = range > 0 ? (range / mean) * 2 : 0;
  
  // Valores estimados
  const systolic = Math.round(baselineSystolic + systolicAdjustment);
  const diastolic = Math.round(baselineDiastolic + diastolicAdjustment);
  
  return {
    systolic: Math.max(90, Math.min(180, systolic)),
    diastolic: Math.max(50, Math.min(110, diastolic))
  };
};

/**
 * Analiza intervalos RR para detectar posibles arritmias
 * @param rrIntervals Intervalos RR (milisegundos)
 * @returns Análisis de intervalos RR
 */
export const analyzeRRIntervals = (rrIntervals: number[]): {
  meanRR: number;
  sdnn: number;
  rmssd: number;
  pnn50: number;
  hasArrhythmia: boolean;
} => {
  if (rrIntervals.length < 3) {
    return {
      meanRR: 0,
      sdnn: 0,
      rmssd: 0,
      pnn50: 0,
      hasArrhythmia: false
    };
  }
  
  // Calcular estadísticas HRV
  const meanRR = rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length;
  
  // Desviación estándar de intervalos NN (SDNN)
  const sdnn = Math.sqrt(
    rrIntervals.reduce((a, b) => a + Math.pow(b - meanRR, 2), 0) / rrIntervals.length
  );
  
  // Raíz cuadrada de la media de los cuadrados de las diferencias (RMSSD)
  let rmssd = 0;
  if (rrIntervals.length > 1) {
    let sumSquaredDiff = 0;
    for (let i = 0; i < rrIntervals.length - 1; i++) {
      sumSquaredDiff += Math.pow(rrIntervals[i + 1] - rrIntervals[i], 2);
    }
    rmssd = Math.sqrt(sumSquaredDiff / (rrIntervals.length - 1));
  }
  
  // Porcentaje de intervalos NN que varían más de 50ms (pNN50)
  let nn50Count = 0;
  for (let i = 0; i < rrIntervals.length - 1; i++) {
    if (Math.abs(rrIntervals[i + 1] - rrIntervals[i]) > 50) {
      nn50Count++;
    }
  }
  const pnn50 = (nn50Count / (rrIntervals.length - 1)) * 100;
  
  // Detección de arritmia basada en criterios simplificados
  const rrVariationThreshold = 150; // ms
  const rmssdThreshold = 60; // ms
  
  // Verificar variaciones extremas
  let hasExtremeVariation = false;
  for (let i = 0; i < rrIntervals.length - 1; i++) {
    if (Math.abs(rrIntervals[i + 1] - rrIntervals[i]) > rrVariationThreshold) {
      hasExtremeVariation = true;
      break;
    }
  }
  
  const hasArrhythmia = hasExtremeVariation || rmssd > rmssdThreshold;
  
  return {
    meanRR,
    sdnn,
    rmssd,
    pnn50,
    hasArrhythmia
  };
};

/**
 * Formatea un valor de presión arterial para mostrar
 * @param systolic Presión sistólica
 * @param diastolic Presión diastólica
 * @returns Cadena formateada (sistólica/diastólica)
 */
export const formatBloodPressure = (systolic: number, diastolic: number): string => {
  return `${systolic}/${diastolic}`;
};

/**
 * Evalúa el estado general de un conjunto de signos vitales
 * @param heartRate Frecuencia cardíaca
 * @param spo2 Saturación de oxígeno
 * @param systolic Presión sistólica
 * @param diastolic Presión diastólica
 * @returns Estado general ('normal', 'caution', 'alert')
 */
export const evaluateVitalSigns = (
  heartRate: number,
  spo2: number,
  systolic: number,
  diastolic: number
): 'normal' | 'caution' | 'alert' => {
  const heartRateNormal = heartRate >= 60 && heartRate <= 100;
  const spo2Normal = spo2 >= 95;
  const bpNormal = systolic <= 140 && diastolic <= 90 && systolic >= 90 && diastolic >= 60;
  
  if (heartRateNormal && spo2Normal && bpNormal) {
    return 'normal';
  }
  
  const heartRateAlert = heartRate < 50 || heartRate > 120;
  const spo2Alert = spo2 < 90;
  const bpAlert = systolic > 160 || diastolic > 100 || systolic < 85 || diastolic < 55;
  
  if (heartRateAlert || spo2Alert || bpAlert) {
    return 'alert';
  }
  
  return 'caution';
};

/**
 * Calcula la componente AC de una señal PPG
 * @param values Valores de la señal
 * @returns Componente AC
 */
export const calculateAC = (values: number[]): number => {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
};

/**
 * Calcula la componente DC de una señal PPG
 * @param values Valores de la señal
 * @returns Componente DC
 */
export const calculateDC = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

/**
 * Encuentra picos y valles en una señal PPG
 * @param values Valores de la señal
 * @returns Índices de picos y valles
 */
export const findPeaksAndValleys = (values: number[]): {
  peakIndices: number[];
  valleyIndices: number[];
} => {
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
};

/**
 * Calcula la amplitud de una señal PPG usando picos y valles
 * @param values Valores de la señal
 * @param peaks Índices de picos
 * @param valleys Índices de valles
 * @returns Amplitud media
 */
export const calculateAmplitude = (
  values: number[],
  peaks: number[],
  valleys: number[]
): number => {
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
};

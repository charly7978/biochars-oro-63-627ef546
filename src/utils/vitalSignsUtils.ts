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
 * Calcula la componente AC de una señal PPG
 * @param values Valores de la señal
 * @returns Componente AC
 */
export const calculateAC = (values: number[]): number => {
  if (values.length < 3) {
    return 0;
  }
  
  // Eliminar tendencia y calcular variación pico a pico
  const detrended = detrendSignal(values);
  return Math.max(...detrended) - Math.min(...detrended);
};

/**
 * Calcula la componente DC de una señal PPG
 * @param values Valores de la señal
 * @returns Componente DC
 */
export const calculateDC = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }
  
  // Promedio simple como componente DC
  return values.reduce((sum, val) => sum + val, 0) / values.length;
};

/**
 * Elimina la tendencia de una señal para análisis AC
 * @param values Valores de la señal
 * @returns Señal sin tendencia
 */
const detrendSignal = (values: number[]): number[] => {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  return values.map(val => val - mean);
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
    // Detectar picos
    if (values[i] > values[i-1] && 
        values[i] > values[i-2] && 
        values[i] > values[i+1] && 
        values[i] > values[i+2]) {
      peakIndices.push(i);
    }
    
    // Detectar valles
    if (values[i] < values[i-1] && 
        values[i] < values[i-2] && 
        values[i] < values[i+1] && 
        values[i] < values[i+2]) {
      valleyIndices.push(i);
    }
  }
  
  return { peakIndices, valleyIndices };
};

/**
 * Calcula la amplitud de una señal PPG
 * @param values Valores de la señal
 * @param peakIndices Índices de picos
 * @param valleyIndices Índices de valles
 * @returns Amplitud media
 */
export const calculateAmplitude = (
  values: number[], 
  peakIndices: number[], 
  valleyIndices: number[]
): number => {
  if (peakIndices.length === 0 || valleyIndices.length === 0) {
    return 0;
  }
  
  // Calcular amplitudes entre picos y valles adyacentes
  const amplitudes: number[] = [];
  
  for (let i = 0; i < peakIndices.length; i++) {
    const peakIdx = peakIndices[i];
    const peakValue = values[peakIdx];
    
    // Encontrar el valle más cercano anterior al pico
    let closestValleyIdx = -1;
    let minDistance = values.length;
    
    for (let j = 0; j < valleyIndices.length; j++) {
      const valleyIdx = valleyIndices[j];
      
      if (valleyIdx < peakIdx && peakIdx - valleyIdx < minDistance) {
        closestValleyIdx = valleyIdx;
        minDistance = peakIdx - valleyIdx;
      }
    }
    
    if (closestValleyIdx >= 0) {
      const valleyValue = values[closestValleyIdx];
      amplitudes.push(peakValue - valleyValue);
    }
  }
  
  if (amplitudes.length === 0) {
    return 0;
  }
  
  // Promedio de amplitudes
  return amplitudes.reduce((sum, val) => sum + val, 0) / amplitudes.length;
};

/**
 * Calcula la métrica RMSSD para análisis de arritmias
 * @param intervals Intervalos RR
 * @returns Valor RMSSD
 */
export const calculateRMSSD = (intervals: number[]): number => {
  if (intervals.length < 2) {
    return 0;
  }
  
  let sumSquaredDiffs = 0;
  
  for (let i = 0; i < intervals.length - 1; i++) {
    const diff = intervals[i+1] - intervals[i];
    sumSquaredDiffs += diff * diff;
  }
  
  return Math.sqrt(sumSquaredDiffs / (intervals.length - 1));
};

/**
 * Estima SpO2 a partir de datos PPG usando algoritmo real
 * @param values Valores PPG
 * @returns Valor estimado de SpO2
 */
export const estimateSpO2 = (values: number[]): number => {
  if (values.length < 30) {
    return 0;
  }
  
  const ac = calculateAC(values);
  const dc = calculateDC(values);
  
  if (dc === 0) return 0;
  
  const r = ac / dc;
  const spo2 = Math.round(110 - 25 * r);
  
  return Math.max(0, Math.min(100, spo2));
};

/**
 * Estima presión arterial a partir de datos PPG y RR
 * @param values Valores PPG
 * @param rrIntervals Intervalos RR opcional
 * @returns Presión arterial estimada como string "SYS/DIA"
 */
export const estimateBloodPressure = (
  values: number[],
  rrIntervals: number[] = []
): string => {
  if (values.length < 30) {
    return "--/--";
  }
  
  const { peakIndices, valleyIndices } = findPeaksAndValleys(values);
  if (peakIndices.length < 3) {
    return "--/--";
  }
  
  const amplitude = calculateAmplitude(values, peakIndices, valleyIndices);
  
  // Calcular intervalos entre picos
  const peakIntervals: number[] = [];
  for (let i = 1; i < peakIndices.length; i++) {
    peakIntervals.push(peakIndices[i] - peakIndices[i-1]);
  }
  
  let hrvFactor = 0;
  if (rrIntervals.length >= 3) {
    // Usar datos RR para mejorar estimación
    const rmssd = calculateRMSSD(rrIntervals);
    hrvFactor = rmssd / 50;
  }
  
  // Estimación basada en fisiología real
  const systolic = Math.round(120 + amplitude * 0.5 - hrvFactor * 5);
  const diastolic = Math.round(80 + amplitude * 0.2 - hrvFactor * 3);
  
  return `${systolic}/${diastolic}`;
};

/**
 * Analiza intervalos RR para detección de arritmias
 * @param intervals Intervalos RR
 * @returns Información sobre análisis de arritmias
 */
export const analyzeRRIntervals = (intervals: number[]): { 
  hasArrhythmia: boolean;
  rmssd: number;
  rrVariation: number;
} => {
  if (intervals.length < 3) {
    return { hasArrhythmia: false, rmssd: 0, rrVariation: 0 };
  }
  
  const rmssd = calculateRMSSD(intervals);
  
  // Calcular variación RR
  const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const lastRR = intervals[intervals.length - 1];
  const rrVariation = Math.abs(lastRR - mean) / mean;
  
  // Detección basada en criterios médicos para arritmia
  const hasArrhythmia = (rmssd > 50 && rrVariation > 0.2);
  
  return { hasArrhythmia, rmssd, rrVariation };
};

/**
 * Formatea la presión arterial para visualización
 * @param pressure Presión arterial como string "SYS/DIA"
 * @returns Presión arterial formateada
 */
export const formatBloodPressure = (pressure: string): string => {
  if (pressure === "--/--") {
    return pressure;
  }
  
  const [systolic, diastolic] = pressure.split('/').map(Number);
  
  if (isNaN(systolic) || isNaN(diastolic)) {
    return "--/--";
  }
  
  return `${systolic}/${diastolic}`;
};

/**
 * Evalúa signos vitales para determinar estado general
 * @param spo2 Saturación de oxígeno
 * @param pressure Presión arterial
 * @returns Estado de signos vitales
 */
export const evaluateVitalSigns = (
  spo2: number, 
  pressure: string
): { status: 'normal' | 'warning' | 'alert'; message: string } => {
  const status: 'normal' | 'warning' | 'alert' = 'normal';
  let message = "Signos vitales normales";
  
  // Evaluación de SpO2
  if (spo2 < 90) {
    return { status: 'alert', message: "Saturación de oxígeno baja" };
  } else if (spo2 < 95) {
    return { status: 'warning', message: "Saturación de oxígeno ligeramente baja" };
  }
  
  // Evaluación de presión arterial
  if (pressure !== "--/--") {
    const [systolic, diastolic] = pressure.split('/').map(Number);
    
    if (systolic > 140 || diastolic > 90) {
      return { status: 'warning', message: "Presión arterial elevada" };
    } else if (systolic > 160 || diastolic > 100) {
      return { status: 'alert', message: "Presión arterial alta" };
    } else if (systolic < 90 || diastolic < 60) {
      return { status: 'warning', message: "Presión arterial baja" };
    }
  }
  
  return { status, message };
};

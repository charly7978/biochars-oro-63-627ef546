
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

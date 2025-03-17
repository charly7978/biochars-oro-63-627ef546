
/**
 * Utilidades reutilizables para todos los procesadores de signos vitales
 * Evita duplicación de código entre diferentes módulos
 */
import { FilterUtils } from "../modules/signal-processing/FilterUtils";

// Re-export the functions from FilterUtils for backward compatibility
export const calculateAC = FilterUtils.calculateAC;
export const calculateDC = FilterUtils.calculateDC;
export const calculateStandardDeviation = FilterUtils.calculateStandardDeviation;
export const findPeaksAndValleys = FilterUtils.findPeaksAndValleys;

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
  
  // Usamos un enfoque más flexible para relacionar picos y valles
  // Para cada pico, buscamos el valle más cercano
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
    
    if (closestValleyIdx !== -1 && minDistance < 10) { // Limitamos a valles cercanos
      const amp = values[peakIdx] - values[closestValleyIdx];
      if (amp > 0) {
        amps.push(amp);
      }
    }
  }
  
  if (amps.length === 0) return 0;

  // Usamos todos los valores para calcular la media
  return amps.reduce((a, b) => a + b, 0) / amps.length;
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
 * Amplifica la señal de forma adaptativa basada en su amplitud
 */
export function amplifySignal(value: number, recentValues: number[]): number {
  if (recentValues.length === 0) return value;
  
  // Calcular la amplitud reciente
  const recentMin = Math.min(...recentValues);
  const recentMax = Math.max(...recentValues);
  const recentRange = recentMax - recentMin;
  
  // Factor de amplificación inversamente proporcional a la amplitud
  // Señales débiles se amplifican más
  let amplificationFactor = 1.0;
  if (recentRange < 0.1) {
    amplificationFactor = 2.5; // Alta amplificación para señales muy débiles
  } else if (recentRange < 0.3) {
    amplificationFactor = 1.8; // Amplificación media para señales débiles
  } else if (recentRange < 0.5) {
    amplificationFactor = 1.4; // Baja amplificación para señales medias
  }
  
  // Centrar el valor respecto a la media y amplificar
  const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
  const centeredValue = value - mean;
  const amplifiedValue = (centeredValue * amplificationFactor) + mean;
  
  return amplifiedValue;
}

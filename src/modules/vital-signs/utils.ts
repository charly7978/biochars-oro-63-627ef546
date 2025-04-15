
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Re-export vital sign utilities from the central location
 * All functions process only real data without simulation.
 */

export {
  calculateAC,
  calculateDC,
  calculateStandardDeviation,
  calculateAmplitude,
  amplifySignal,
  calculatePerfusionIndex
} from '../../utils/vitalSignsUtils';

/**
 * Find peaks and valleys in a signal array
 * Only processes real data
 */
export function findPeaksAndValleys(
  signal: number[], 
  windowSize: number = 5
): { peaks: number[], valleys: number[] } {
  if (signal.length < windowSize * 2) {
    return { peaks: [], valleys: [] };
  }
  
  const peaks: number[] = [];
  const valleys: number[] = [];
  
  // Skip first and last few points to ensure we have enough context
  for (let i = windowSize; i < signal.length - windowSize; i++) {
    const currentValue = signal[i];
    
    // Check if this is a peak
    let isPeak = true;
    for (let j = i - windowSize; j < i; j++) {
      if (signal[j] >= currentValue) {
        isPeak = false;
        break;
      }
    }
    
    if (isPeak) {
      for (let j = i + 1; j <= i + windowSize; j++) {
        if (signal[j] >= currentValue) {
          isPeak = false;
          break;
        }
      }
    }
    
    if (isPeak) {
      peaks.push(i);
      continue; // If it's a peak, it can't also be a valley
    }
    
    // Check if this is a valley
    let isValley = true;
    for (let j = i - windowSize; j < i; j++) {
      if (signal[j] <= currentValue) {
        isValley = false;
        break;
      }
    }
    
    if (isValley) {
      for (let j = i + 1; j <= i + windowSize; j++) {
        if (signal[j] <= currentValue) {
          isValley = false;
          break;
        }
      }
    }
    
    if (isValley) {
      valleys.push(i);
    }
  }
  
  return { peaks, valleys };
}

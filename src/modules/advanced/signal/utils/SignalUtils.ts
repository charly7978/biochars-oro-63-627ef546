
/**
 * Utilidades para procesamiento de señales
 */

/**
 * Normaliza una señal para el procesamiento
 */
export function normalizeSignal(values: number[]): number[] {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const centered = values.map(v => v - mean);
  
  const maxAbs = Math.max(...centered.map(Math.abs));
  return centered.map(v => v / (maxAbs || 1));
}

/**
 * Encuentra los índices de máximos y mínimos locales en la señal
 */
export function findExtrema(signal: number[]): { 
  maxIndices: number[]; 
  minIndices: number[]; 
} {
  const maxIndices: number[] = [];
  const minIndices: number[] = [];
  
  // Agregar puntos extremos para mejor interpolación
  minIndices.push(0);
  maxIndices.push(0);
  
  // Buscar extremos
  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] > signal[i-1] && signal[i] > signal[i+1]) {
      maxIndices.push(i);
    } else if (signal[i] < signal[i-1] && signal[i] < signal[i+1]) {
      minIndices.push(i);
    }
  }
  
  // Agregar puntos extremos para mejor interpolación
  minIndices.push(signal.length - 1);
  maxIndices.push(signal.length - 1);
  
  return { maxIndices, minIndices };
}

/**
 * Interpolación cúbica simplificada para envoltorias
 */
export function interpolate(indices: number[], signal: number[]): number[] {
  if (indices.length < 2) return Array(signal.length).fill(0);
  
  const result = Array(signal.length).fill(0);
  
  // Rellenar valores en índices conocidos
  indices.forEach(idx => {
    result[idx] = signal[idx];
  });
  
  // Interpolación lineal simplificada
  let currentIndex = 0;
  for (let i = 0; i < signal.length; i++) {
    if (i > indices[currentIndex + 1]) {
      currentIndex++;
    }
    
    if (currentIndex >= indices.length - 1) break;
    
    const x1 = indices[currentIndex];
    const x2 = indices[currentIndex + 1];
    const y1 = signal[x1];
    const y2 = signal[x2];
    
    if (i > x1 && i < x2) {
      // Interpolación lineal
      result[i] = y1 + (y2 - y1) * (i - x1) / (x2 - x1);
    }
  }
  
  return result;
}

/**
 * Verifica si una señal es monotónica (sin oscilaciones)
 */
export function isMonotonic(signal: number[]): boolean {
  let increasing = 0;
  let decreasing = 0;
  
  for (let i = 1; i < signal.length; i++) {
    if (signal[i] > signal[i-1]) {
      increasing++;
    } else if (signal[i] < signal[i-1]) {
      decreasing++;
    }
  }
  
  // Es monotónica si más del 90% de los cambios van en la misma dirección
  const total = increasing + decreasing;
  return total > 0 && (increasing / total > 0.9 || decreasing / total > 0.9);
}

/**
 * Calcula la amplitud media de una señal
 */
export function calculateAmplitude(signal: number[]): number {
  const absValues = signal.map(Math.abs);
  return absValues.reduce((sum, v) => sum + v, 0) / signal.length;
}

/**
 * Estima la frecuencia de una señal basada en cruces por cero
 */
export function estimateFrequency(signal: number[]): number {
  // Contar cruces por cero
  let zeroCrossings = 0;
  for (let i = 1; i < signal.length; i++) {
    if (signal[i] * signal[i-1] < 0) {
      zeroCrossings++;
    }
  }
  
  // Estimar frecuencia basada en cruces por cero
  const samplingRate = 30; // Aproximado para PPG
  return zeroCrossings * samplingRate / (2 * signal.length);
}

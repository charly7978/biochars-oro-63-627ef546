
/**
 * Utilidades para el procesamiento de señales PPG
 */

/**
 * Aplica compensación de artefactos por presión
 */
export function applyPressureCompensation(values: number[], pressureArtifactLevel: number): number[] {
  // Implementación simplificada de compensación de artefactos
  return values.map(v => v * (1 + pressureArtifactLevel * 0.2));
}

/**
 * Convierte estructura de picos para compatibilidad con AFibDetector
 */
export function adaptPeakData(peakInfo: { 
  peakIndices: number[]; 
  intervals: number[]; 
}): { 
  peaks: number[]; 
  intervals: number[]; 
} {
  return {
    peaks: peakInfo.peakIndices,
    intervals: peakInfo.intervals
  };
}

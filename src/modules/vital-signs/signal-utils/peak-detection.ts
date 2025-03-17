
/**
 * Peak detection utilities
 * Provides functions for identifying peaks and valleys in signals
 */

/**
 * Finds peaks and valleys in a signal
 */
export function findPeaksAndValleys(values: number[]): { peakIndices: number[]; valleyIndices: number[] } {
  const peakIndices: number[] = [];
  const valleyIndices: number[] = [];

  // Algoritmo para detección de picos y valles usando ventana de 5 puntos
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


/**
 * Utilidades para detección de picos y valles en señales PPG
 * Solo trabaja con datos reales, sin simulación
 */

/**
 * Encuentra picos en una señal PPG
 * @param values Array de valores de señal PPG
 * @param threshold Umbral para detección de picos
 */
export function findPeaks(values: number[], threshold = 0.02): number[] {
  const peaks: number[] = [];
  
  // Algoritmo simplificado para detección de picos locales
  for (let i = 1; i < values.length - 1; i++) {
    const val = values[i];
    if (val > values[i - 1] && val > values[i + 1] && val > threshold) {
      peaks.push(i);
    }
  }
  
  return peaks;
}

/**
 * Encuentra valles en una señal PPG
 * @param values Array de valores de señal PPG
 * @param threshold Umbral para detección de valles
 */
export function findValleys(values: number[], threshold = 0.02): number[] {
  const valleys: number[] = [];
  
  // Algoritmo simplificado para detección de valles locales
  for (let i = 1; i < values.length - 1; i++) {
    const val = values[i];
    if (val < values[i - 1] && val < values[i + 1] && val < threshold) {
      valleys.push(i);
    }
  }
  
  return valleys;
}

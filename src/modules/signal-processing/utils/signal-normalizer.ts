
/**
 * Normalizador de señal
 * Implementa funciones para normalizar la señal PPG
 */

/**
 * Normaliza un valor de señal respecto a una línea base
 */
export function normalizeSignal(
  value: number,
  baselineValue: number
): number {
  return value - baselineValue;
}

/**
 * Calcula la línea base a partir de un buffer de valores
 */
export function calculateBaseline(
  buffer: number[],
  currentBaseline: number,
  weight: number = 0.2
): number {
  if (buffer.length === 0) {
    return currentBaseline;
  }

  // Calcular promedio del buffer
  const average = buffer.reduce((sum, val) => sum + val, 0) / buffer.length;

  // Actualizar línea base con ponderación
  return currentBaseline * (1 - weight) + average * weight;
}

/**
 * Amplifica un valor normalizado
 */
export function amplifySignal(
  normalizedValue: number,
  gain: number,
  values: number[] = []
): number {
  // Ganancia fija
  let effectiveGain = gain;

  // Si hay suficientes valores y se desea ganancia adaptativa
  if (values.length >= 10) {
    // Calcular variabilidad reciente
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Ajustar ganancia inversamente a la desviación estándar
    if (stdDev < 0.1) {
      // Más ganancia para señal estable
      effectiveGain = gain * (1 + (0.1 - stdDev) * 10);
    } else {
      // Menos ganancia para señal muy variable
      effectiveGain = gain / (1 + (stdDev - 0.1) * 5);
    }
  }

  return normalizedValue * effectiveGain;
}

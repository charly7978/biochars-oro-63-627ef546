
/**
 * Detector de calidad de señal
 * Evalúa la calidad de la señal PPG
 */

export interface SignalQualityConfig {
  minStdDev: number;          // Desviación estándar mínima para buena calidad
  optimalStdDev: number;      // Desviación estándar óptima
  maxStdDev: number;          // Desviación estándar máxima para buena calidad
  amplitudeFactor: number;    // Factor para evaluar contribución de amplitud
  stdDevFactor: number;       // Factor para evaluar contribución de variabilidad
}

/**
 * Evalúa la calidad de la señal (0-100)
 */
export function assessSignalQuality(
  values: number[],
  fingerDetected: boolean,
  config: SignalQualityConfig = {
    minStdDev: 0.01,
    optimalStdDev: 0.15,
    maxStdDev: 0.5,
    amplitudeFactor: 0.3,
    stdDevFactor: 0.7
  }
): number {
  // Si no se detecta dedo, calidad cero
  if (!fingerDetected) {
    return 0;
  }

  // Si no hay suficientes muestras, retornar calidad basada en amplitud simple
  if (values.length < 5) {
    const lastValue = values[values.length - 1] || 0;
    return Math.min(100, Math.max(0, Math.abs(lastValue) * 200));
  }

  // Calcular estadísticas de la señal
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const lastValue = values[values.length - 1];

  // Calidad basada en desviación estándar (mejor cuando está cerca del valor óptimo)
  let stdDevQuality = 0;
  
  if (stdDev >= config.minStdDev && stdDev <= config.maxStdDev) {
    if (stdDev < config.optimalStdDev) {
      // Antes del óptimo, calidad aumenta linealmente
      stdDevQuality = (stdDev - config.minStdDev) / (config.optimalStdDev - config.minStdDev) * 100;
    } else {
      // Después del óptimo, calidad disminuye linealmente
      stdDevQuality = 100 - (stdDev - config.optimalStdDev) / (config.maxStdDev - config.optimalStdDev) * 100;
    }
  }

  // Calidad basada en amplitud
  const absValue = Math.abs(lastValue);
  const amplitudeQuality = Math.min(100, absValue * 300);

  // Combinar ambas métricas
  const quality = stdDevQuality * config.stdDevFactor + amplitudeQuality * config.amplitudeFactor;

  return Math.round(Math.min(100, Math.max(0, quality)));
}

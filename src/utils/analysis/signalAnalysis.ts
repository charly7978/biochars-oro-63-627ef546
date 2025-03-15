
/**
 * Utilities for analyzing PPG signals
 */

/**
 * Calcula la calidad de una señal basada en su variabilidad y consistencia
 * @param values Valores de la señal
 * @returns Calidad de la señal (0-100)
 */
export const calculateSignalQuality = (values: number[]): number => {
  if (values.length < 10) return 0;
  
  // Calcular estadísticas básicas
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const coeffVar = stdDev / Math.abs(mean);
  
  // Señal demasiado estable o demasiado variable
  if (coeffVar < 0.01 || coeffVar > 0.8) {
    return 20;
  }
  
  // Escala logarítmica para el coeficiente de variación
  // Máxima calidad alrededor de 0.2-0.3
  const qualityFactor = Math.max(0, Math.min(1, 1 - (Math.abs(0.2 - coeffVar) / 0.2)));
  
  return qualityFactor * 100;
};

/**
 * Calcula la componente AC (variación) de una señal PPG
 * @param values Valores de la señal
 * @returns Componente AC
 */
export const calculateAC = (values: number[]): number => {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
};

/**
 * Calcula la componente DC (nivel base) de una señal PPG
 * @param values Valores de la señal
 * @returns Componente DC
 */
export const calculateDC = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

/**
 * Calcula el índice de perfusión (relación AC/DC) de una señal PPG
 * @param values Valores de la señal
 * @returns Índice de perfusión
 */
export const calculatePerfusionIndex = (values: number[]): number => {
  const ac = calculateAC(values);
  const dc = calculateDC(values);
  return dc !== 0 ? ac / dc : 0;
};

/**
 * Calcula el RMSSD (Root Mean Square of Successive Differences) para intervalos RR
 * Indicador clave para detección de arritmias
 * @param intervals Intervalos RR en milisegundos
 * @returns Valor RMSSD
 */
export const calculateRMSSD = (intervals: number[]): number => {
  if (intervals.length < 2) return 0;
  
  let sumSquaredDiff = 0;
  for (let i = 1; i < intervals.length; i++) {
    const diff = intervals[i] - intervals[i-1];
    sumSquaredDiff += diff * diff;
  }
  
  return Math.sqrt(sumSquaredDiff / (intervals.length - 1));
};

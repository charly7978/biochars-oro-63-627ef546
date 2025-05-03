
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Comprueba la calidad de la señal y detecta si es demasiado débil
 * Usa solo datos reales sin simulación
 */
export function checkSignalQuality(
  value: number,
  consecutiveWeakSignals: number,
  config: {
    lowSignalThreshold: number;
    maxWeakSignalCount: number;
  }
): { isWeakSignal: boolean; updatedWeakSignalsCount: number } {
  const { lowSignalThreshold, maxWeakSignalCount } = config;
  
  // Verificar si la señal es débil basado en su amplitud absoluta
  const valueAbs = value < 0 ? -value : value;
  const isCurrentlyWeak = valueAbs < lowSignalThreshold;
  
  // Actualizar contador de señales débiles consecutivas
  let updatedWeakSignalsCount = isCurrentlyWeak
    ? consecutiveWeakSignals + 1
    : Math.max(0, consecutiveWeakSignals - 1);
  
  // Determinar si la señal debe considerarse como débil en general
  // (cuando hay demasiadas muestras débiles consecutivas)
  const isWeakSignal = updatedWeakSignalsCount > maxWeakSignalCount;
  
  return { isWeakSignal, updatedWeakSignalsCount };
}

/**
 * Función auxiliar para calcular valor absoluto sin Math
 */
function absoluteValue(value: number): number {
  return value < 0 ? -value : value;
}

export function getSignalQualityScore(
  values: number[],
  minLength: number = 10
): { quality: number; amplitude: number } {
  // Verificación básica
  if (values.length < minLength) {
    return { quality: 0, amplitude: 0 };
  }
  
  // Calcular mínimo y máximo
  let min = values[0];
  let max = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] < min) min = values[i];
    if (values[i] > max) max = values[i];
  }
  
  // Calcular amplitud
  const amplitude = max - min;
  
  // Si la amplitud es demasiado baja, la calidad es cero
  if (amplitude < 0.01) {
    return { quality: 0, amplitude };
  }
  
  // Calcular calidad basada en:
  // 1. Amplitud relativa
  const amplitudeQuality = amplitude < 0.05 ? amplitude * 20 : 1;
  
  // 2. Variabilidad (desviación)
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
  }
  const mean = sum / values.length;
  
  let varianceSum = 0;
  for (let i = 0; i < values.length; i++) {
    const diff = values[i] - mean;
    varianceSum += diff * diff;
  }
  const variance = varianceSum / values.length;
  const normalizedVariance = variance / (amplitude * amplitude);
  
  // Menor varianza = mejor señal (más regular)
  const varianceQuality = 1.0 / (1.0 + normalizedVariance * 10);
  
  // Calidad combinada (70% amplitud, 30% variabilidad)
  const quality = amplitudeQuality * 0.7 + varianceQuality * 0.3;
  
  // Escalar a 0-100
  return {
    quality: quality * 100,
    amplitude
  };
}

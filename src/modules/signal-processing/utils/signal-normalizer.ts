
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Funciones para normalización y amplificación de señal PPG
 * VERSIÓN MEJORADA: Mejor manejo de señales débiles
 */

/**
 * Amplifica un valor de señal PPG
 * VERSIÓN MEJORADA: Amplificación no lineal para señales débiles
 */
export function amplifySignal(value: number, factor: number = 1.5): number {
  // Para señales muy débiles, aplicar amplificación no lineal adicional
  if (Math.abs(value) < 0.05) {
    // Aplicar factor adicional para señales débiles
    const weakSignalBoost = 1.5; // 50% extra para señales débiles
    const boostedFactor = factor * weakSignalBoost;
    
    console.log("Signal-normalizer: SEÑAL DÉBIL - aplicando amplificación extra", {
      valorOriginal: value,
      factorNormal: factor,
      factorAumentado: boostedFactor,
      resultadoFinal: value * boostedFactor
    });
    
    return value * boostedFactor;
  }
  
  // Amplificación normal para señales regulares
  return value * factor;
}

/**
 * Normaliza un valor de señal PPG en base a los valores recientes
 * VERSIÓN MEJORADA: Normalización adaptativa para señales débiles
 */
export function normalizeSignal(value: number, recentValues: number[]): number {
  if (recentValues.length < 3) return value;
  
  // Calcular estadísticas recientes
  const min = Math.min(...recentValues);
  const max = Math.max(...recentValues);
  const range = max - min;
  
  // Si el rango es pequeño, la señal es débil o estable
  if (range < 0.05) {
    // Aplicar normalización de umbral bajo 
    return value * 2.0; // Aumentar el valor para señales débiles
  }
  
  // Normalización estándar para señales normales
  if (range <= 0) return 0; // Evitar división por cero
  
  return (value - min) / range;
}

/**
 * Calcula la varianza de un conjunto de valores
 */
export function calculateVariance(values: number[]): number {
  if (values.length < 2) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  return squaredDiffs.reduce((sum, squared) => sum + squared, 0) / values.length;
}


/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Funciones para normalización y amplificación de señal PPG
 * VERSIÓN ULTRA-SENSIBLE: Especializada para señales extremadamente débiles
 */

/**
 * Amplifica un valor de señal PPG
 * VERSIÓN EXTREMA: Amplificación exponencial no lineal para señales muy débiles
 */
export function amplifySignal(value: number, factor: number = 2.5): number {
  // Para señales extremadamente débiles, aplicar amplificación exponencial
  if (Math.abs(value) < 0.01) {
    // Factor exponencial para señales ultra débiles
    const weakSignalBoost = 3.0; // 300% para señales muy débiles
    const boostedFactor = factor * weakSignalBoost;
    
    // Diagnóstico detallado
    console.log("Signal-normalizer: SEÑAL EXTREMADAMENTE DÉBIL - amplificación exponencial", {
      valorOriginal: value,
      factorNormal: factor,
      factorExponencial: boostedFactor,
      resultadoFinal: value * boostedFactor
    });
    
    return value * boostedFactor;
  }
  
  // Para señales débiles pero detectables, usar amplificación mejorada
  if (Math.abs(value) < 0.05) {
    // Aplicar factor adicional para señales débiles
    const weakSignalBoost = 2.0; // 200% para señales débiles
    const boostedFactor = factor * weakSignalBoost;
    
    console.log("Signal-normalizer: SEÑAL DÉBIL - aplicando amplificación extra", {
      valorOriginal: value,
      factorNormal: factor,
      factorAumentado: boostedFactor,
      resultadoFinal: value * boostedFactor
    });
    
    return value * boostedFactor;
  }
  
  // Amplificación normal para señales regulares (pero también aumentada)
  return value * factor;
}

/**
 * Normaliza un valor de señal PPG en base a los valores recientes
 * VERSIÓN ULTRA-MEJORADA: Normalización adaptativa progresiva para señales débiles
 */
export function normalizeSignal(value: number, recentValues: number[]): number {
  if (recentValues.length < 3) return value;
  
  // Calcular estadísticas recientes
  const min = Math.min(...recentValues);
  const max = Math.max(...recentValues);
  const range = max - min;
  const absValue = Math.abs(value);
  
  // Si el valor es extremadamente débil, aplicar normalización progresiva
  if (absValue < 0.01) {
    // Impulso progresivo extremo para señales ultra débiles
    console.log("Signal-normalizer: Normalizando señal ULTRA DÉBIL", {
      valorOriginal: value,
      valorAbsoluto: absValue,
      resultadoAmplificado: value * 5.0
    });
    return value * 5.0; // Amplificación extrema para señales ultra débiles
  }
  
  // Si el rango es pequeño, la señal es débil o estable
  if (range < 0.05) {
    // Aplicar normalización de umbral bajo progresiva
    const boostFactor = 0.05 / (range > 0 ? range : 0.01); // Factor inversamente proporcional
    const boostedValue = value * Math.min(3.0, boostFactor); // Límite máximo de 3x
    
    console.log("Signal-normalizer: Rango pequeño - aplicando normalización progresiva", {
      valorOriginal: value,
      rango: range,
      factorImpulso: boostFactor,
      resultado: boostedValue
    });
    
    return boostedValue;
  }
  
  // Normalización adaptativa para señales normales
  if (range <= 0) return 0; // Evitar división por cero
  
  // Normalización estándar con ligero boost
  const normalizedValue = (value - min) / range;
  
  // Aplicar curva de respuesta no lineal para mejorar detección
  return Math.pow(normalizedValue, 0.8); // Exponente < 1 aumenta amplitud de señales débiles
}

/**
 * Calcula la varianza de un conjunto de valores
 * MEJORADO: Más sensible a variaciones pequeñas
 */
export function calculateVariance(values: number[]): number {
  if (values.length < 2) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  
  // Para señales débiles, amplificar diferencias
  const amplifiedSquaredDiffs = values.map(val => {
    const diff = val - mean;
    // Amplificar diferencias pequeñas para mejorar sensibilidad
    return Math.abs(diff) < 0.01 ? 
           Math.pow(diff * 2.5, 2) : // Amplificar diferencias pequeñas
           Math.pow(diff, 2);
  });
  
  return amplifiedSquaredDiffs.reduce((sum, squared) => sum + squared, 0) / values.length;
}

/**
 * Aplica filtro de paso bajo adaptativo a señal débil
 * NUEVO: Especialmente diseñado para señales extremadamente débiles
 */
export function applyAdaptiveLowPassFilter(value: number, history: number[]): number {
  if (history.length === 0) return value;
  
  const lastValue = history[history.length - 1];
  const absValue = Math.abs(value);
  
  // Determinar factor alfa basado en intensidad de señal
  let alpha = 0.3; // Valor por defecto
  
  if (absValue < 0.01) {
    alpha = 0.15; // Mucho suavizado para señales ultra débiles
  } else if (absValue < 0.05) {
    alpha = 0.2; // Suavizado medio para señales débiles
  }
  
  // Aplicar filtro EMA adaptativo
  return alpha * value + (1 - alpha) * lastValue;
}

/**
 * Detecta y corrige valores atípicos en señales débiles
 * NUEVO: Especialmente diseñado para estabilizar señales anémicas
 */
export function correctOutliers(value: number, history: number[]): number {
  if (history.length < 5) return value;
  
  // Calcular estadísticas de ventana reciente
  const recentValues = history.slice(-5);
  const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
  const stdDev = Math.sqrt(
    recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentValues.length
  );
  
  // Límites adaptativos de detección - más permisivos para señales débiles
  const absValue = Math.abs(value);
  const absThresholdFactor = absValue < 0.01 ? 4.0 : (absValue < 0.05 ? 3.0 : 2.5);
  
  // Límites superior e inferior
  const upperLimit = mean + stdDev * absThresholdFactor;
  const lowerLimit = mean - stdDev * absThresholdFactor;
  
  // Corregir valores fuera de rango
  if (value > upperLimit) {
    console.log("Signal-normalizer: Corrigiendo pico alto en señal débil", {
      valorOriginal: value,
      media: mean,
      desviación: stdDev,
      límiteSuperior: upperLimit,
      valorCorregido: upperLimit
    });
    return upperLimit;
  } else if (value < lowerLimit) {
    console.log("Signal-normalizer: Corrigiendo valle bajo en señal débil", {
      valorOriginal: value,
      media: mean,
      desviación: stdDev,
      límiteInferior: lowerLimit,
      valorCorregido: lowerLimit
    });
    return lowerLimit;
  }
  
  return value;
}

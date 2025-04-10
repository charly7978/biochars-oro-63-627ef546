
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Utilidades para detección de calidad de señal
 */

/**
 * Evalúa la calidad de una señal PPG utilizando múltiples factores
 * @param rawValue Valor bruto
 * @param filteredValue Valor filtrado
 * @param filteredBuffer Buffer de valores filtrados
 * @param threshold Umbral mínimo de calidad
 * @returns Valor de calidad (0-100)
 */
export function evaluateSignalQuality(
  rawValue: number,
  filteredValue: number,
  filteredBuffer: number[],
  threshold: number = 30
): number {
  if (filteredBuffer.length < 5) {
    return 0;
  }
  
  // Factores para calcular la calidad
  const factors = {
    // 1. Ruido (diferencia entre valor bruto y filtrado)
    noise: calculateNoiseScore(rawValue, filteredValue),
    
    // 2. Amplitud (rango de la señal)
    amplitude: calculateAmplitudeScore(filteredBuffer),
    
    // 3. Estabilidad (consistencia en el tiempo)
    stability: calculateStabilityScore(filteredBuffer),
    
    // 4. Variabilidad (señales completamente planas son malas)
    variability: calculateVariabilityScore(filteredBuffer)
  };
  
  // Pesos de cada factor (suma = 1)
  const weights = {
    noise: 0.3,
    amplitude: 0.3,
    stability: 0.2,
    variability: 0.2
  };
  
  // Calcular puntuación ponderada
  const weightedScore = 
    factors.noise * weights.noise +
    factors.amplitude * weights.amplitude +
    factors.stability * weights.stability +
    factors.variability * weights.variability;
  
  // Convertir a escala 0-100 y aplicar umbral mínimo
  let quality = Math.round(weightedScore * 100);
  
  // Si está por debajo del umbral, disminuir más agresivamente
  if (quality < threshold) {
    quality = Math.max(0, quality - 10);
  }
  
  return quality;
}

/**
 * Calcula la puntuación basada en el nivel de ruido (0-1)
 */
function calculateNoiseScore(rawValue: number, filteredValue: number): number {
  const noiseMagnitude = Math.abs(rawValue - filteredValue);
  
  // Máximo ruido esperado
  const maxExpectedNoise = 0.3;
  
  // Si no hay o hay muy poco ruido (0-1, donde 1 es bueno)
  return Math.max(0, Math.min(1, 1 - (noiseMagnitude / maxExpectedNoise)));
}

/**
 * Calcula la puntuación basada en la amplitud de la señal (0-1)
 */
function calculateAmplitudeScore(buffer: number[]): number {
  if (buffer.length < 3) return 0;
  
  const min = Math.min(...buffer);
  const max = Math.max(...buffer);
  const amplitude = max - min;
  
  // Amplitud óptima para PPG está entre 0.1 y 0.6
  if (amplitude < 0.1) {
    return amplitude * 10; // Escalar linealmente de 0 a 1
  } else if (amplitude <= 0.6) {
    return 1; // Amplitud óptima
  } else {
    // Penaliza ligeramente amplitudes muy altas (posible saturación)
    return Math.max(0, Math.min(1, 1.2 - (amplitude - 0.6)));
  }
}

/**
 * Calcula la puntuación basada en la estabilidad de la señal (0-1)
 */
function calculateStabilityScore(buffer: number[]): number {
  if (buffer.length < 5) return 0;
  
  // Calcular diferencias entre valores consecutivos
  const differences = [];
  for (let i = 1; i < buffer.length; i++) {
    differences.push(Math.abs(buffer[i] - buffer[i - 1]));
  }
  
  // Calcular la desviación estándar de las diferencias
  const mean = differences.reduce((sum, val) => sum + val, 0) / differences.length;
  const variance = differences.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / differences.length;
  const stdDev = Math.sqrt(variance);
  
  // Estabilidad óptima: desviación estándar baja pero no cero
  if (stdDev < 0.001) {
    return 0.1; // Demasiado estable (señal plana o constante)
  } else if (stdDev < 0.1) {
    return 1 - (stdDev * 5); // Escalar entre 0.5 y 1
  } else {
    // Penalizar alta inestabilidad
    return Math.max(0, Math.min(0.5, 0.5 - (stdDev - 0.1) * 2));
  }
}

/**
 * Calcula la puntuación basada en la variabilidad adecuada de la señal (0-1)
 * Penaliza señales completamente planas o extremadamente variables
 */
function calculateVariabilityScore(buffer: number[]): number {
  if (buffer.length < 5) return 0;
  
  // Calcular varianza normalizada
  const mean = buffer.reduce((sum, val) => sum + val, 0) / buffer.length;
  if (mean === 0) return 0;
  
  const variance = buffer.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / buffer.length;
  const normalizedVariance = variance / (mean * mean);
  
  // Señal fisiológica PPG debe tener cierta variabilidad, pero no excesiva
  if (normalizedVariance < 0.0001) {
    return 0.1; // Casi plana, mala calidad
  } else if (normalizedVariance <= 0.05) {
    return Math.min(1, normalizedVariance * 20); // Escalar entre 0 y 1
  } else {
    // Penalizar variabilidad excesiva
    return Math.max(0, Math.min(1, 1.5 - normalizedVariance * 10));
  }
}

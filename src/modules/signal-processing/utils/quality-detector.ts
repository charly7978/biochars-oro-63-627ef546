
/**
 * Utilidades para evaluar la calidad de señal PPG
 */

/**
 * Evalúa la calidad general de la señal PPG
 */
export function assessSignalQuality(values: number[], fingerDetected: boolean): number {
  if (!fingerDetected || values.length < 5) {
    return 0;
  }
  
  return evaluateSignalQuality(values);
}

/**
 * Implementa algoritmo avanzado de evaluación de calidad
 */
export function evaluateSignalQuality(values: number[]): number {
  if (values.length < 10) {
    return 30; // Calidad base para señales cortas
  }
  
  // Calcular estadísticas de señal
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / (Math.abs(mean) || 0.001); // Evitar división por cero
  
  // Calcular rango de amplitud
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  
  // Criterios de calidad basados en características de señal real
  
  // 1. Amplitud insuficiente = mala calidad
  if (range < 0.05) {
    return 10;
  }
  
  // 2. Amplitud adecuada = calidad base
  let quality = 50;
  
  // 3. Variabilidad moderada (señal estable pero con pulsos claros)
  if (cv > 0.05 && cv < 0.5) {
    quality += 20;
  } else if (cv > 1.0) {
    quality -= 30; // Muy variable = probablemente ruidosa
  }
  
  // 4. Señal periódica (buscar cruces por cero o cambios de pendiente)
  const directionChanges = countDirectionChanges(values);
  const expectedChanges = values.length / 10; // Asumiendo un latido cada ~10 puntos
  const changeRatio = directionChanges / expectedChanges;
  
  if (changeRatio > 0.7 && changeRatio < 1.5) {
    quality += 20; // Patrones consistentes con pulso cardíaco
  }
  
  // 5. Ajuste final basado en amplitud y estabilidad combinadas
  if (range > 0.1 && cv < 0.3) {
    quality += 15; // Buena amplitud y estabilidad
  }
  
  // Garantizar rango de calidad entre 0 y 100
  return Math.max(0, Math.min(100, quality));
}

/**
 * Cuenta cambios de dirección en la señal (indicador de periodicidad)
 */
function countDirectionChanges(values: number[]): number {
  if (values.length < 3) return 0;
  
  let changes = 0;
  for (let i = 2; i < values.length; i++) {
    const prev_diff = values[i-1] - values[i-2];
    const curr_diff = values[i] - values[i-1];
    
    if ((prev_diff >= 0 && curr_diff < 0) || (prev_diff < 0 && curr_diff >= 0)) {
      changes++;
    }
  }
  
  return changes;
}

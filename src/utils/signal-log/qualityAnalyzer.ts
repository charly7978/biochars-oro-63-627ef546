
/**
 * Signal quality analysis utilities
 */

/**
 * Calculate signal quality based on variance and stability
 * to detect potential false positives
 */
export function calculateSignalQuality(values: number[]): number {
  if (!values || values.length < 10) {
    return 0;
  }
  
  // Calcular varianza
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  
  // Calcular derivada para detectar cambios abruptos (posibles artefactos)
  const derivatives = [];
  for (let i = 1; i < values.length; i++) {
    derivatives.push(Math.abs(values[i] - values[i-1]));
  }
  
  const maxDerivative = Math.max(...derivatives);
  const avgDerivative = derivatives.reduce((sum, val) => sum + val, 0) / derivatives.length;
  
  // Si hay cambios demasiado abruptos, la calidad debe ser menor
  const derivativeRatio = maxDerivative / (avgDerivative + 0.001);
  const derivativeScore = derivativeRatio > 5 ? 50 : 100;
  
  // Calcular estabilidad (espaciado consistente entre picos)
  const peaks = findSignalPeaks(values);
  let stabilityScore = 100;
  
  if (peaks.length >= 3) {
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i-1]);
    }
    
    const intervalMean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const intervalVariance = intervals.reduce((sum, val) => sum + Math.pow(val - intervalMean, 2), 0) / intervals.length;
    
    // Mayor varianza = menor estabilidad
    stabilityScore = 100 - Math.min(100, (intervalVariance / (intervalMean + 0.001)) * 100);
  } else {
    stabilityScore = 30; // No hay suficientes picos para una buena medida de estabilidad
  }
  
  // Incorporar amplitud de señal en calidad
  const range = Math.max(...values) - Math.min(...values);
  const amplitudeScore = range < 1 ? 20 : // Muy poca variación = baja calidad
                       range > 100 ? 60 : // Demasiada variación = calidad media
                       100; // Rango óptimo
  
  // Combinar varianza, estabilidad y amplitud para puntuación final
  const varianceScore = variance < 0.5 ? 30 : 
                      variance > 100 ? 50 :
                      100 - Math.min(100, Math.abs(variance - 20) * 2);
  
  // Ponderación de factores para una mejor calidad
  const qualityScore = (
    varianceScore * 0.3 + 
    stabilityScore * 0.3 + 
    derivativeScore * 0.2 + 
    amplitudeScore * 0.2
  );
  
  return Math.round(qualityScore);
}

/**
 * Find peaks in signal with strict validation
 */
export function findSignalPeaks(values: number[]): number[] {
  if (values.length < 12) return []; // Requerir más puntos para detección robusta
  
  const peaks = [];
  const MIN_PEAK_DISTANCE = 5;
  
  // Calcular umbral adaptativo
  const max = Math.max(...values);
  const min = Math.min(...values);
  const threshold = (max - min) * 0.35; // Umbral más elevado (35% del rango)
  
  // Añadir más criterios de calidad para picos
  for (let i = 3; i < values.length - 3; i++) {
    if (values[i] > values[i-1] && 
        values[i] > values[i-2] && 
        values[i] > values[i-3] && 
        values[i] > values[i+1] && 
        values[i] > values[i+2] &&
        values[i] > values[i+3] &&
        values[i] - Math.min(values[i-3], values[i-2], values[i-1], values[i+1], values[i+2], values[i+3]) > threshold) {
      
      // Verificar si este pico está lo suficientemente lejos del pico anterior
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= MIN_PEAK_DISTANCE) {
        // Verificar que el pico no sea un artefacto (demasiado abrupto)
        const leftSlope = (values[i] - values[i-1]);
        const rightSlope = (values[i] - values[i+1]);
        
        // Rechazar picos con pendientes extremadamente asimétricas
        const slopeRatio = Math.max(leftSlope, rightSlope) / (Math.min(leftSlope, rightSlope) + 0.001);
        
        if (slopeRatio < 3) { // Permitir cierta asimetría pero no extrema
          peaks.push(i);
        }
      }
    }
  }
  
  return peaks;
}


/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Verifica la calidad de la señal para detección de dedo
 * Utiliza técnicas adaptativas de umbral basadas en características de la señal
 */
export function checkSignalQuality(
  value: number,
  currentWeakSignalsCount: number,
  options?: { 
    lowSignalThreshold?: number, 
    maxWeakSignalCount?: number 
  }
): { isWeakSignal: boolean, updatedWeakSignalsCount: number } {
  // Valores por defecto
  const weakSignalThreshold = options?.lowSignalThreshold || 0.25;
  const maxWeakSignals = options?.maxWeakSignalCount || 5;

  // Detectar señal débil
  if (Math.abs(value) < weakSignalThreshold) {
    // Incrementar contador de señales débiles
    const updatedCount = currentWeakSignalsCount + 1;
    const isWeak = updatedCount >= maxWeakSignals;
    
    return { 
      isWeakSignal: isWeak, 
      updatedWeakSignalsCount: updatedCount 
    };
  } else {
    // Reducir contador de señales débiles más rápidamente (recuperación)
    const updatedCount = Math.max(0, currentWeakSignalsCount - 2);
    return { 
      isWeakSignal: updatedCount >= maxWeakSignals, 
      updatedWeakSignalsCount: updatedCount 
    };
  }
}

/**
 * Calcula la variabilidad de la señal para detección de señal fisiológica
 */
export function calculateSignalVariability(buffer: number[]): number {
  if (buffer.length < 5) return 0;
  
  // Calcular media y varianza
  const mean = buffer.reduce((sum, val) => sum + val, 0) / buffer.length;
  const variance = buffer.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / buffer.length;
  
  // Normalizar varianza
  const normalizedVariance = variance / (mean * mean + 0.001); // Evitar división por cero
  
  return normalizedVariance;
}

/**
 * Validar que la señal esté en rango fisiológico
 */
export function validateSignalRange(value: number): boolean {
  // Verificar que la señal esté en un rango razonable
  return value >= -100 && value <= 100;
}

/**
 * Calcular índice de calidad de la señal (0-100)
 */
export function calculateSignalQuality(
  buffer: number[], 
  options?: { 
    minThreshold?: number, 
    maxThreshold?: number 
  }
): number {
  if (buffer.length < 10) return 0;
  
  // Umbrales
  const minThreshold = options?.minThreshold || 0.05;
  const maxThreshold = options?.maxThreshold || 10;
  
  // Calcular variabilidad
  const variability = calculateSignalVariability(buffer);
  
  // Calcular amplitud
  const min = Math.min(...buffer);
  const max = Math.max(...buffer);
  const amplitude = max - min;
  
  // Calcular estabilidad
  const recentValues = buffer.slice(-5);
  const recentMean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
  const recentVar = recentValues.reduce((sum, val) => sum + Math.pow(val - recentMean, 2), 0) / recentValues.length;
  const normalizedRecentVar = recentVar / (recentMean * recentMean + 0.001);
  
  // Factores de calidad (rango 0-1)
  const amplitudeFactor = Math.min(1, Math.max(0, (amplitude - minThreshold) / (maxThreshold - minThreshold)));
  
  // Variabilidad óptima entre 0.01 y 0.5 (señales demasiado estables o demasiado variables son sospechosas)
  const variabilityFactor = variability > 0.01 && variability < 0.5 ? 1 : Math.max(0, 1 - Math.abs(variability - 0.1) / 0.5);
  
  // Estabilidad reciente (menor variación = mayor calidad)
  const stabilityFactor = Math.max(0, 1 - normalizedRecentVar * 10);
  
  // Calcular calidad final (0-100)
  const quality = Math.min(100, Math.max(0, 
    amplitudeFactor * 40 + 
    variabilityFactor * 40 + 
    stabilityFactor * 20
  ));
  
  return Math.round(quality);
}

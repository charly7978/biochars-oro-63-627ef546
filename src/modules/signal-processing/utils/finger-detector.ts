
/**
 * Utilidades para detección de dedo en señal PPG
 */

/**
 * Detecta la presencia de un dedo basado en características de la señal
 */
export function detectFinger(
  values: number[], 
  stabilityCounter: number,
  options: {
    threshold?: number,
    stabilityThreshold?: number,
    minStdDev?: number,
    maxStdDev?: number,
    minAmplitude?: number
  } = {}
): { detected: boolean, updatedCounter: number } {
  // Parámetros con valores por defecto
  const {
    threshold = 0.1,
    stabilityThreshold = 5,
    minStdDev = 0.01,
    maxStdDev = 0.5,
    minAmplitude = 0.05
  } = options;
  
  // Si no hay suficientes valores, no podemos detectar el dedo
  if (values.length < 5) {
    return { detected: false, updatedCounter: 0 };
  }
  
  // Calcular estadísticas de la señal
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  // Calcular rango de señal
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  
  // Criterios para detección de dedo:
  // 1. Variabilidad adecuada (ni demasiado estable ni demasiado ruidosa)
  const variabilityCriterion = stdDev >= minStdDev && stdDev <= maxStdDev;
  
  // 2. Amplitud suficiente
  const amplitudeCriterion = range >= minAmplitude;
  
  // 3. Criterio de periodicidad o patrón
  const recentValues = values.slice(-10);
  const patternCriterion = detectFingerPattern(recentValues);
  
  // Combinamos criterios para decisión final
  const fingerDetected = (variabilityCriterion && amplitudeCriterion) || patternCriterion;
  
  // Manejamos estabilidad mediante contador
  let updatedCounter = stabilityCounter;
  
  if (fingerDetected) {
    updatedCounter = Math.min(stabilityCounter + 1, stabilityThreshold + 5);
  } else {
    updatedCounter = Math.max(stabilityCounter - 1, 0);
  }
  
  // La detección final depende del contador de estabilidad
  return {
    detected: updatedCounter >= stabilityThreshold,
    updatedCounter
  };
}

/**
 * Detecta patrones específicos de PPG que indican presencia de dedo
 */
function detectFingerPattern(values: number[]): boolean {
  if (values.length < 8) return false;
  
  // Contamos cambios de dirección (picos y valles)
  let directionChanges = 0;
  for (let i = 2; i < values.length; i++) {
    const prev_diff = values[i-1] - values[i-2];
    const curr_diff = values[i] - values[i-1];
    
    if ((prev_diff >= 0 && curr_diff < 0) || (prev_diff < 0 && curr_diff >= 0)) {
      directionChanges++;
    }
  }
  
  // Patrón típico de PPG: al menos 2-3 cambios en 10 puntos
  const hasRhythmicPattern = directionChanges >= 2 && directionChanges <= 6;
  
  // Verificamos amplitud en relación a la media
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const deviations = values.map(v => Math.abs(v - mean));
  const avgDeviation = deviations.reduce((sum, val) => sum + val, 0) / deviations.length;
  
  // Más confianza si hay desviación significativa respecto a la media
  const hasAmplitude = avgDeviation > 0.02;
  
  return hasRhythmicPattern && hasAmplitude;
}

/**
 * Detecta contacto de dedo con análisis específico para calidad PPG
 */
export function detectFingerContact(values: number[]): boolean {
  if (values.length < 10) return false;
  
  // Implementación avanzada para detección de contacto real de dedo
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  
  // Criterios para contacto de dedo:
  // 1. Señal debe tener varianza no nula (no estática)
  if (variance < 0.00001) return false;
  
  // 2. Debe tener componente periódica
  const periodicityScore = assessPeriodicity(values);
  
  // 3. Amplitud adecuada
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  
  return periodicityScore > 0.5 && range > 0.03;
}

/**
 * Evalúa la periodicidad de una señal
 */
function assessPeriodicity(values: number[]): number {
  if (values.length < 20) return 0;
  
  // Simplificado: contamos cambios de dirección y evaluamos si son regulares
  const directionChanges: number[] = [];
  let lastChangeIndex = -1;
  
  for (let i = 2; i < values.length; i++) {
    const prev_diff = values[i-1] - values[i-2];
    const curr_diff = values[i] - values[i-1];
    
    if ((prev_diff >= 0 && curr_diff < 0) || (prev_diff < 0 && curr_diff >= 0)) {
      if (lastChangeIndex >= 0) {
        directionChanges.push(i - lastChangeIndex);
      }
      lastChangeIndex = i;
    }
  }
  
  if (directionChanges.length < 2) return 0;
  
  // Calcular regularidad de cambios
  const mean = directionChanges.reduce((sum, val) => sum + val, 0) / directionChanges.length;
  const variance = directionChanges.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / directionChanges.length;
  const cv = Math.sqrt(variance) / mean;
  
  // Menor coeficiente de variación = más regular = más periódica
  return Math.max(0, 1 - cv);
}

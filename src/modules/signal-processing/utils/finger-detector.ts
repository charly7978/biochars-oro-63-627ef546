
/**
 * Detector de presencia de dedo
 * Implementa lógica para detectar si hay un dedo sobre la cámara
 */

export interface FingerDetectionConfig {
  threshold: number;           // Umbral mínimo de señal
  stabilityThreshold: number;  // Número de muestras estables requeridas
  minStdDev: number;           // Desviación estándar mínima
  maxStdDev: number;           // Desviación estándar máxima
}

/**
 * Detecta la presencia de un dedo sobre la cámara
 */
export function detectFinger(
  values: number[],
  stabilityCounter: number,
  config: FingerDetectionConfig = {
    threshold: 0.08,
    stabilityThreshold: 5,
    minStdDev: 0.01,
    maxStdDev: 0.5
  }
): { detected: boolean; updatedCounter: number } {
  // Si no hay suficientes muestras, no se puede detectar dedo
  if (values.length < 10) {
    return { detected: false, updatedCounter: 0 };
  }

  // Calcular estadísticas de la señal
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // Criterios de detección:
  // 1. La media debe estar por encima del umbral
  // 2. Debe haber cierta variabilidad pero no demasiada
  const condition1 = Math.abs(mean) > config.threshold;
  const condition2 = stdDev > config.minStdDev && stdDev < config.maxStdDev;

  let updatedCounter = stabilityCounter;
  
  if (condition1 && condition2) {
    updatedCounter = Math.min(config.stabilityThreshold + 3, updatedCounter + 1);
  } else {
    updatedCounter = Math.max(0, updatedCounter - 1);
  }

  const isDetected = updatedCounter >= config.stabilityThreshold;

  return { detected: isDetected, updatedCounter };
}

// Alias para compatibilidad con código existente
export const detectFingerContact = detectFinger;

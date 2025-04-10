
/**
 * Signal quality assessment utilities
 */

// Buffers para detección de patrones
let patternDetectionBuffer: number[] = [];
let patternConsistencyCounter = 0;
const MIN_PATTERN_COUNT = 2; // Reducido de 3 a 2
const MAX_PATTERN_BUFFER = 120;

/**
 * Verificar si se detectan patrones rítmicos en el historial de señales
 * 
 * @param signalHistory Historial de señales
 * @param currentPatternCount Contador actual de patrones
 * @returns Resultado de detección de patrones
 */
export function isFingerDetectedByPattern(
  signalHistory: Array<{time: number, value: number}>,
  currentPatternCount: number
): { isFingerDetected: boolean, patternCount: number } {
  // Necesitamos suficientes puntos para analizar (reducido de 30 a 20)
  if (signalHistory.length < 20) {
    return {
      isFingerDetected: false,
      patternCount: 0
    };
  }
  
  // Extraer valores recientes para análisis
  const recentValues = signalHistory.slice(-20).map(p => p.value);
  
  // Calcular diferencias entre puntos consecutivos para detectar variación rítmica
  const diffs: number[] = [];
  for (let i = 1; i < recentValues.length; i++) {
    diffs.push(recentValues[i] - recentValues[i-1]);
  }
  
  // Contar cambios de signo, que indican oscilaciones
  let signChanges = 0;
  for (let i = 1; i < diffs.length; i++) {
    if ((diffs[i] >= 0 && diffs[i-1] < 0) || (diffs[i] < 0 && diffs[i-1] >= 0)) {
      signChanges++;
    }
  }
  
  // Más de 4 cambios de signo en 20 puntos suele indicar un patrón cardíaco (reducido de 6 a 4)
  const isRhythmicPattern = signChanges >= 4;
  
  // Actualizar contador de patrones
  let updatedPatternCount = currentPatternCount;
  if (isRhythmicPattern) {
    updatedPatternCount++;
    
    // Registrar detección si superamos el umbral
    if (updatedPatternCount === MIN_PATTERN_COUNT) {
      console.log("Signal quality: Patrón rítmico detectado - posible pulso cardíaco", {
        signChanges, 
        patternCount: updatedPatternCount,
        timestamp: new Date().toISOString()
      });
    }
  } else {
    // Reducir contador pero no por debajo de cero
    updatedPatternCount = Math.max(0, updatedPatternCount - 1);
  }
  
  return {
    isFingerDetected: updatedPatternCount >= MIN_PATTERN_COUNT,
    patternCount: updatedPatternCount
  };
}

/**
 * Check if the signal quality is too low, indicating possible finger removal
 * 
 * @param value Current signal value
 * @param consecutiveWeakSignalsCount Number of consecutive weak signals detected
 * @param config Configuration options
 * @returns Result with weak signal status and updated counter
 */
export function checkSignalQuality(
  value: number,
  consecutiveWeakSignalsCount: number,
  config: {
    lowSignalThreshold: number;
    maxWeakSignalCount: number;
  }
): {
  isWeakSignal: boolean;
  updatedWeakSignalsCount: number;
} {
  // Reducir umbral para mayor sensibilidad
  const threshold = config.lowSignalThreshold || 0.03; // Reducido de 0.05 a 0.03
  const maxWeakCount = config.maxWeakSignalCount || 15; // Aumentado de 10 a 15 para mayor tolerancia
  
  // Update pattern detection buffer
  patternDetectionBuffer.push(value);
  if (patternDetectionBuffer.length > MAX_PATTERN_BUFFER) {
    patternDetectionBuffer.shift();
  }
  
  // Check if signal is weak
  const isWeak = Math.abs(value) < threshold;
  
  // Update consecutive weak signals counter
  let updatedCount = isWeak 
    ? consecutiveWeakSignalsCount + 1
    : 0;
  
  // Determine if signal is too weak - requiere más señales débiles consecutivas
  const isTooWeak = updatedCount >= maxWeakCount;
  
  // Log when signal becomes too weak
  if (isTooWeak && consecutiveWeakSignalsCount < maxWeakCount) {
    console.log("Signal quality: Signal too weak, possible finger removal", {
      threshold,
      signalValue: value,
      weakCount: updatedCount,
      timestamp: new Date().toISOString()
    });
  }
  
  return {
    isWeakSignal: isTooWeak,
    updatedWeakSignalsCount: updatedCount
  };
}

/**
 * Reset all detection states
 */
export function resetDetectionStates(): void {
  patternDetectionBuffer = [];
  patternConsistencyCounter = 0;
  
  console.log("Signal quality: Detection states reset", {
    timestamp: new Date().toISOString()
  });
}

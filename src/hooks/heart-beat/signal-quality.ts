
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

// Estado para tracking de calidad de señal
let debugInfo = {
  weakSignalsCount: 0,
  lastCheckTime: 0,
  signalQuality: 0,
  fingerDetected: false,
  signalHistory: [] as number[],
  isCalibrating: false
};

/**
 * Verifica si la señal es demasiado débil, indicando posible
 * remoción del dedo o colocación incorrecta
 */
export function checkWeakSignal(value: number, threshold: number = 0.05): boolean {
  debugInfo.lastCheckTime = Date.now();
  
  // Actualizar historial para cálculos de calidad
  if (debugInfo.signalHistory.length > 30) {
    debugInfo.signalHistory.shift();
  }
  debugInfo.signalHistory.push(value);
  
  // Usar valor absoluto para considerar señales negativas
  return Math.abs(value) < threshold;
}

/**
 * Verificar si una señal debe procesarse o ignorarse
 */
export function shouldProcessMeasurement(signalValue: number): boolean {
  return Math.abs(signalValue) >= 0.02; // Umbral mínimo para procesar
}

/**
 * Crear un resultado para señales débiles
 */
export function createWeakSignalResult(): any {
  return {
    bpm: 0,
    confidence: 0,
    isPeak: false,
    arrhythmiaCount: 0,
    rrData: {
      intervals: [],
      lastPeakTime: null
    }
  };
}

/**
 * Verificar la calidad general de la señal y contar señales débiles consecutivas
 */
export function checkSignalQuality(
  value: number, 
  currentWeakSignalsCount: number,
  config: {
    lowSignalThreshold: number;
    maxWeakSignalCount: number;
  } = {
    lowSignalThreshold: 0.05,
    maxWeakSignalCount: 5
  }
): {
  isWeakSignal: boolean;
  updatedWeakSignalsCount: number;
} {
  const isWeak = checkWeakSignal(value, config.lowSignalThreshold);
  let updatedCount = currentWeakSignalsCount;
  
  if (isWeak) {
    updatedCount++;
  } else {
    // Reducir contador más lentamente para evitar fluctuaciones
    updatedCount = Math.max(0, updatedCount - 0.5);
  }
  
  // Límite superior para contador
  updatedCount = Math.min(updatedCount, config.maxWeakSignalCount + 5);
  
  // La señal se considera débil si hay muchas señales débiles consecutivas
  const isWeakSignal = updatedCount >= config.maxWeakSignalCount;
  
  // Actualizar estado para debugging
  debugInfo.weakSignalsCount = updatedCount;
  
  return {
    isWeakSignal,
    updatedWeakSignalsCount: updatedCount
  };
}

/**
 * Verifica si se detecta un dedo usando análisis de señal
 */
export function isFingerDetected(value: number, signalQuality: number): boolean {
  // Actualizar estado para debugging
  debugInfo.fingerDetected = value > 0.05 && signalQuality > 40;
  
  return debugInfo.fingerDetected;
}

/**
 * Resetear el estado de calidad de señal
 */
export function resetSignalQualityState(): void {
  debugInfo = {
    weakSignalsCount: 0,
    lastCheckTime: 0,
    signalQuality: 0,
    fingerDetected: false,
    signalHistory: [],
    isCalibrating: false
  };
}

/**
 * Obtener información de debug sobre calidad de señal
 */
export function getSignalQualityDebugInfo(): typeof debugInfo {
  return {...debugInfo};
}

/**
 * Nuevo: Detectar movimiento en la señal PPG
 */
export function detectMotionInSignal(
  value: number,
  signalHistory: number[],
  threshold: number = 0.5
): boolean {
  if (signalHistory.length < 5) return false;
  
  // Calcular derivada
  const recentValues = [...signalHistory.slice(-5), value];
  const derivatives = [];
  
  for (let i = 1; i < recentValues.length; i++) {
    derivatives.push(Math.abs(recentValues[i] - recentValues[i-1]));
  }
  
  // Calcular estadísticas
  const sortedDerivatives = [...derivatives].sort((a, b) => a - b);
  const medianDerivative = sortedDerivatives[Math.floor(sortedDerivatives.length / 2)];
  const maxDerivative = Math.max(...derivatives);
  
  // Detectar cambios anormalmente altos
  return maxDerivative > medianDerivative * threshold;
}

/**
 * Nuevo: Evaluar la consistencia de una señal PPG
 */
export function evaluateSignalConsistency(
  signalHistory: number[],
  windowSize: number = 15
): {
  consistency: number; // 0-100
  hasMotion: boolean;
} {
  if (signalHistory.length < windowSize) {
    return { consistency: 0, hasMotion: false };
  }
  
  const recentSignal = signalHistory.slice(-windowSize);
  
  // Calcular variación pico a pico
  const min = Math.min(...recentSignal);
  const max = Math.max(...recentSignal);
  const peakToPeak = max - min;
  
  // Calcular derivadas para detección de movimiento
  const derivatives = [];
  for (let i = 1; i < recentSignal.length; i++) {
    derivatives.push(Math.abs(recentSignal[i] - recentSignal[i-1]));
  }
  
  // Ordenar derivadas para análisis estadístico
  const sortedDerivatives = [...derivatives].sort((a, b) => a - b);
  const medianDerivative = sortedDerivatives[Math.floor(sortedDerivatives.length / 2)];
  const p90Derivative = sortedDerivatives[Math.floor(sortedDerivatives.length * 0.9)];
  
  // Calcular ratio entre derivadas altas y medianas
  const motionRatio = p90Derivative / (medianDerivative + 0.0001);
  const hasMotion = motionRatio > 3.0; // Umbral para considerar movimiento
  
  // Calcular consistencia basada en variabilidad de derivadas
  // Mayor variabilidad = menor consistencia
  let consistency = 100 - Math.min(100, (motionRatio - 1) * 25);
  
  // Ajustar por amplitud (señales muy pequeñas no son confiables)
  if (peakToPeak < 0.1) {
    consistency *= (peakToPeak / 0.1);
  }
  
  return {
    consistency: Math.max(0, Math.round(consistency)),
    hasMotion
  };
}

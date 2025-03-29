
/**
 * Módulo centralizado para la verificación de calidad de señal
 * Proporciona funciones optimizadas para evaluar la calidad de la señal PPG
 */

export interface SignalQualityOptions {
  lowSignalThreshold: number;
  maxWeakSignalCount: number;
}

const DEFAULT_OPTIONS: SignalQualityOptions = {
  lowSignalThreshold: 0.15,
  maxWeakSignalCount: 4
};

/**
 * Verifica la calidad de la señal PPG y determina si es demasiado débil
 * @param value Valor de la señal PPG
 * @param currentWeakSignalsCount Contador actual de señales débiles
 * @param options Opciones para la verificación
 * @returns Objeto con indicadores de calidad de señal
 */
export const checkSignalQuality = (
  value: number,
  currentWeakSignalsCount: number,
  options: Partial<SignalQualityOptions> = {}
): { isWeakSignal: boolean; updatedWeakSignalsCount: number } => {
  // Combinar opciones con valores predeterminados
  const { lowSignalThreshold, maxWeakSignalCount } = {
    ...DEFAULT_OPTIONS,
    ...options
  };

  // Determinar si la señal es débil basado en su valor absoluto
  const isCurrentSignalWeak = Math.abs(value) < lowSignalThreshold;
  
  // Actualizar el contador de señales débiles
  let updatedWeakSignalsCount = currentWeakSignalsCount;
  
  if (isCurrentSignalWeak) {
    // Incrementar contador si la señal actual es débil
    updatedWeakSignalsCount = Math.min(maxWeakSignalCount + 2, currentWeakSignalsCount + 1);
  } else {
    // Reducir gradualmente el contador si la señal es fuerte
    // La reducción es más lenta para mantener estabilidad
    updatedWeakSignalsCount = Math.max(0, currentWeakSignalsCount - 0.5);
  }
  
  // La señal se considera débil si hemos acumulado suficientes señales débiles consecutivas
  const isWeakSignal = updatedWeakSignalsCount >= maxWeakSignalCount;
  
  if (updatedWeakSignalsCount === maxWeakSignalCount && isWeakSignal) {
    console.log('Señal débil detectada, puede indicar dedo removido o mal posicionado');
  }
  
  return { isWeakSignal, updatedWeakSignalsCount };
};

/**
 * Determinar si debemos procesar la medición basado en la calidad de la señal
 * @param signalQuality Calidad de la señal (0-100)
 * @param isFingerDetected Indicador de dedo detectado
 * @param weakSignalsCount Contador de señales débiles
 * @returns Verdadero si debemos procesar la medición
 */
export const shouldProcessMeasurement = (
  signalQuality: number,
  isFingerDetected: boolean,
  weakSignalsCount: number
): boolean => {
  // Requisitos para procesamiento:
  // 1. El dedo debe estar detectado
  // 2. La calidad de la señal debe ser aceptable (>30)
  // 3. No demasiadas señales débiles consecutivas
  return (
    isFingerDetected &&
    signalQuality > 30 &&
    weakSignalsCount < DEFAULT_OPTIONS.maxWeakSignalCount
  );
};

/**
 * Crear un resultado para señal débil (todos los valores en cero/predeterminados)
 * @returns Objeto con valores de resultado predeterminados
 */
export const createWeakSignalResult = () => {
  return {
    bpm: 0,
    confidence: 0,
    isPeak: false,
    isArrhythmia: false,
    arrhythmiaCount: 0,
    rrData: {
      intervals: [],
      lastPeakTime: null
    }
  };
};

/**
 * Resetear el estado de calidad de señal
 * @returns Objeto con valores iniciales de calidad de señal
 */
export const resetSignalQualityState = () => {
  return {
    weakSignalsCount: 0,
    signalQuality: 0,
    isFingerDetected: false
  };
};

/**
 * Resetear los estados de detección
 * Esta función es requerida por HeartBeatProcessor.js
 */
export const resetDetectionStates = () => {
  console.log("Signal quality: Resetting detection states");
  return resetSignalQualityState();
};

/**
 * Detecta si hay un dedo presente basado en patrones rítmicos
 * @param signalHistory Historial de señales con tiempo y valor
 * @param currentPatternCount Contador actual de patrones detectados
 * @returns Objeto con resultado de detección y contador actualizado
 */
export const isFingerDetectedByPattern = (
  signalHistory: Array<{time: number, value: number}>, 
  currentPatternCount: number
): { isFingerDetected: boolean; patternCount: number } => {
  // Implementación básica de detección de ritmo
  if (signalHistory.length < 10) {
    return { isFingerDetected: false, patternCount: 0 };
  }
  
  // Verificar si hay un patrón rítmico en los datos
  let patternDetected = false;
  let updatedPatternCount = currentPatternCount;
  
  // Analizar cruces por cero y regularidad para detectar patrón cardíaco
  const crossings = findZeroCrossings(signalHistory);
  
  if (crossings.length >= 3) {
    const intervals = calculateIntervals(crossings);
    
    // Verificar regularidad de intervalos (característica de señal fisiológica)
    const isRegular = checkRegularity(intervals);
    
    if (isRegular) {
      patternDetected = true;
      updatedPatternCount = Math.min(10, currentPatternCount + 1);
    } else {
      updatedPatternCount = Math.max(0, currentPatternCount - 1);
    }
  } else {
    // Reducir contador gradualmente si no hay suficientes cruces
    updatedPatternCount = Math.max(0, currentPatternCount - 0.5);
  }
  
  // Se considera que hay un dedo si hemos detectado patrones repetidamente
  const isFingerDetected = updatedPatternCount >= 3;
  
  return { isFingerDetected, patternCount: updatedPatternCount };
};

// Funciones auxiliares para la detección de patrones

function findZeroCrossings(signalHistory: Array<{time: number, value: number}>): number[] {
  const crossings: number[] = [];
  
  for (let i = 1; i < signalHistory.length; i++) {
    if ((signalHistory[i-1].value < 0 && signalHistory[i].value >= 0) ||
        (signalHistory[i-1].value >= 0 && signalHistory[i].value < 0)) {
      crossings.push(signalHistory[i].time);
    }
  }
  
  return crossings;
}

function calculateIntervals(crossings: number[]): number[] {
  const intervals: number[] = [];
  
  for (let i = 1; i < crossings.length; i++) {
    intervals.push(crossings[i] - crossings[i-1]);
  }
  
  return intervals;
}

function checkRegularity(intervals: number[]): boolean {
  if (intervals.length < 2) return false;
  
  // Calcular la desviación estándar de los intervalos
  const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  
  // Coeficiente de variación (normalizado por la media)
  const cv = stdDev / mean;
  
  // Un CV bajo indica regularidad (característica de señal cardíaca)
  return cv < 0.5;
}

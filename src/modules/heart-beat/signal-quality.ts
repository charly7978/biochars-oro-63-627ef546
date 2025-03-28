
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

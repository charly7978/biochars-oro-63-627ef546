
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

// Remove or comment out the problematic import
// import { isFingerDetectedByPattern } from '../../../modules/heart-beat/signal-quality';

interface SignalQualityOptions {
  lowSignalThreshold?: number;
  maxWeakSignalCount?: number;
}

/**
 * Verifica si una señal es débil basándose en umbrales configurables
 * Solo procesamiento directo, sin simulaciones
 */
export function checkWeakSignal(
  value: number,
  currentWeakSignalCount: number,
  options: SignalQualityOptions = {}
): { isWeakSignal: boolean; updatedWeakSignalsCount: number } {
  // Default thresholds
  const LOW_SIGNAL_THRESHOLD = options.lowSignalThreshold || 0.05;
  const MAX_WEAK_SIGNALS = options.maxWeakSignalCount || 10;
  
  const isCurrentValueWeak = Math.abs(value) < LOW_SIGNAL_THRESHOLD;
  
  // Update consecutive weak signals counter
  let updatedWeakSignalsCount = isCurrentValueWeak 
    ? currentWeakSignalCount + 1 
    : 0;
  
  // Limit to max
  updatedWeakSignalsCount = Math.min(MAX_WEAK_SIGNALS, updatedWeakSignalsCount);
  
  // Signal is considered weak if we have enough consecutive weak readings
  const isWeakSignal = updatedWeakSignalsCount >= MAX_WEAK_SIGNALS;
  
  return { isWeakSignal, updatedWeakSignalsCount };
}

/**
 * Verifica si se debe procesar una medición según la intensidad de la señal
 */
export function shouldProcessMeasurement(
  value: number,
  weakSignalsCount: number = 0,
  options: SignalQualityOptions = {}
): boolean {
  const { isWeakSignal } = checkWeakSignal(value, weakSignalsCount, options);
  return !isWeakSignal;
}

/**
 * Crea un resultado vacío para señales débiles
 */
export function createWeakSignalResult(arrhythmiaCounter: number = 0): any {
  return {
    bpm: 0,
    confidence: 0,
    isPeak: false,
    arrhythmiaCount: arrhythmiaCounter,
    rrData: {
      intervals: [],
      lastPeakTime: null
    }
  };
}

/**
 * Restablece el estado de detección de señal
 */
export function resetSignalQualityState(): number {
  return 0; // Reset the weak signals counter
}

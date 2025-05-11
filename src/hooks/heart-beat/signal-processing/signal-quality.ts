
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

// Import compatible functions from central module
import { checkSignalQuality as coreCheckSignalQuality } from '../../../modules/heart-beat/signal-quality';

interface SignalQualityOptions {
  lowSignalThreshold?: number;
  maxWeakSignalCount?: number;
}

/**
 * Verifica si una señal es débil basándose en umbrales configurables
 * Solo procesamiento directo, sin simulaciones
 * IMPROVED: Ultra strict thresholds to eliminate false positives
 */
export function checkWeakSignal(
  value: number,
  currentWeakSignalCount: number,
  options: SignalQualityOptions = {}
): { isWeakSignal: boolean; updatedWeakSignalsCount: number } {
  // Use centralized implementation with ultra-strict thresholds
  return coreCheckSignalQuality(value, currentWeakSignalCount, {
    lowSignalThreshold: options.lowSignalThreshold || 0.65, // Increased from 0.45 to 0.65
    maxWeakSignalCount: options.maxWeakSignalCount || 5, // Decreased from 6 to 5
    strictMode: true
  });
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

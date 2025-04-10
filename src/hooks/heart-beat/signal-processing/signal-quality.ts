
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
 * con soporte para el estado de transición para animaciones fluidas
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
    },
    // Agregar soporte para transiciones fluidas
    transition: {
      active: false,
      progress: 0,
      direction: 'none'
    }
  };
}

/**
 * Actualiza el último BPM válido si el resultado tiene buena confianza
 */
export function updateLastValidBpm(
  result: any,
  lastValidBpmRef: React.MutableRefObject<number>
): void {
  if (result.bpm > 40 && result.bpm < 200 && result.confidence > 0.4) {
    lastValidBpmRef.current = result.bpm;
  }
}

/**
 * Procesa resultados con baja confianza
 */
export function processLowConfidenceResult(
  result: any,
  currentBPM: number,
  arrhythmiaCounter: number = 0
): any {
  if (result.confidence < 0.1) {
    return {
      bpm: currentBPM || 0,
      confidence: result.confidence,
      isPeak: false,
      arrhythmiaCount: arrhythmiaCounter,
      rrData: result.rrData || {
        intervals: [],
        lastPeakTime: null
      },
      isArrhythmia: false,
      transition: {
        active: false,
        progress: 0,
        direction: 'none'
      }
    };
  }
  
  // Si hay buena confianza, devolver el resultado con soporte de transición
  return {
    ...result,
    arrhythmiaCount: arrhythmiaCounter,
    // Asegurar que el objeto de transición esté presente para animaciones fluidas
    transition: result.transition || {
      active: result.isPeak,
      progress: 0,
      direction: result.isPeak ? 'up' : 'down'
    }
  };
}

/**
 * Restablece el estado de detección de señal
 */
export function resetSignalQualityState(): number {
  return 0; // Reset the weak signals counter
}

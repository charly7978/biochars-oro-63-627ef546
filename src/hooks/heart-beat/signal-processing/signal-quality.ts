
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { checkSignalQuality } from '../../../modules/heart-beat/signal-quality';

/**
 * Check for weak signal to detect finger removal
 */
export function checkWeakSignal(
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
  return checkSignalQuality(value, consecutiveWeakSignalsCount, config);
}

/**
 * Determine if measurement should be processed based on signal quality
 */
export function shouldProcessMeasurement(
  value: number,
  weakSignalsCount: number = 0,
  options: {
    lowSignalThreshold?: number;
    maxWeakSignalCount?: number;
  } = {}
): boolean {
  const { isWeakSignal } = checkSignalQuality(
    value,
    weakSignalsCount,
    options
  );
  
  return !isWeakSignal && Math.abs(value) > (options.lowSignalThreshold || 0.01);
}

/**
 * Create a safe result object for weak signal scenarios
 * No simulation, just empty result
 */
export function createWeakSignalResult(arrhythmiaCount: number = 0): {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  arrhythmiaCount: number;
  rrData?: {
    intervals: number[];
    lastPeakTime: number | null;
  };
} {
  return {
    bpm: 0,
    confidence: 0,
    isPeak: false,
    arrhythmiaCount,
    rrData: {
      intervals: [],
      lastPeakTime: null
    }
  };
}

/**
 * Reset signal quality tracking state
 */
export function resetSignalQualityState(): number {
  return 0; // Reset weak signals counter to zero
}

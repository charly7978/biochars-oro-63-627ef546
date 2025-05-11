
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { fingerDetectionManager } from '@/services/FingerDetectionService';
import { calculateSNR } from '@/modules/vital-signs/utils/signal-analysis-utils';

/**
 * Check for weak signal to detect finger removal - USANDO SOLO DATOS REALES
 * Ahora integrado con fingerDetectionManager para una única fuente de verdad
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
  const { lowSignalThreshold, maxWeakSignalCount } = config;
  
  // Procesar el valor actual a través del gestor unificado
  const result = fingerDetectionManager.processFrameAndSignal(undefined, value, false);
  const isSignalWeak = !result.isFingerDetected || result.quality < 20;
  
  // Si el gestor unificado detecta señal débil o no detecta dedo, incrementar contador
  if (isSignalWeak || Math.abs(value) < lowSignalThreshold) {
    const updatedCount = consecutiveWeakSignalsCount + 1;
    return {
      isWeakSignal: updatedCount >= maxWeakSignalCount,
      updatedWeakSignalsCount: updatedCount
    };
  }
  
  // Si hay buena detección, resetear contador
  return {
    isWeakSignal: false,
    updatedWeakSignalsCount: 0
  };
}

/**
 * Determine if measurement should be processed based on signal quality
 * SOLO DATOS REALES - Ahora utiliza fingerDetectionManager
 */
export function shouldProcessMeasurement(
  value: number,
  weakSignalsCount: number = 0,
  options: {
    lowSignalThreshold?: number;
    maxWeakSignalCount?: number;
  } = {}
): boolean {
  const threshold = options.lowSignalThreshold || 0.01;
  const maxWeakCount = options.maxWeakSignalCount || 5;
  
  // Consultar al gestor unificado
  const detectionResult = fingerDetectionManager.processFrameAndSignal(undefined, value, false);
  
  // Criterio principal: usar la detección unificada
  if (detectionResult.isFingerDetected && detectionResult.quality > 30) {
    return true;
  }
  
  // Método secundario como respaldo
  const { isWeakSignal } = checkWeakSignal(
    value,
    weakSignalsCount,
    { lowSignalThreshold: threshold, maxWeakSignalCount: maxWeakCount }
  );
  
  return !isWeakSignal && Math.abs(value) > threshold;
}

/**
 * Create a safe result object for weak signal scenarios
 * SOLO DATOS REALES - SIN SIMULACIÓN
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
  // Reset local counter
  fingerDetectionManager.reset();
  return 0; // Reset weak signals counter to zero
}


/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Check for weak signal to detect finger removal - USANDO SOLO DATOS REALES
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
  
  // Si la señal está por debajo del umbral mínimo, incrementar contador
  if (Math.abs(value) < lowSignalThreshold) {
    const updatedCount = consecutiveWeakSignalsCount + 1;
    return {
      isWeakSignal: updatedCount >= maxWeakSignalCount,
      updatedWeakSignalsCount: updatedCount
    };
  }
  
  // Si la señal es suficientemente fuerte, resetear contador
  return {
    isWeakSignal: false,
    updatedWeakSignalsCount: 0
  };
}

/**
 * Determine if measurement should be processed based on signal quality
 * SOLO DATOS REALES
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
  return 0; // Reset weak signals counter to zero
}

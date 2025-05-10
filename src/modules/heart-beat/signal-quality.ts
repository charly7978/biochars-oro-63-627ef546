
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE.
 */

/**
 * Check for weak signal to detect finger removal - USANDO SOLO DATOS REALES
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
 * Reset signal quality tracking state
 */
export function resetSignalQualityState(): number {
  return 0; // Reset weak signals counter to zero
}

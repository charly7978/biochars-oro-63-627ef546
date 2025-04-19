
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Verifica la calidad de la señal PPG para determinar si es viable para procesamiento
 * Todos los cálculos son con datos reales, sin simulación
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
  
  // Verificar si la señal es demasiado débil
  const isCurrentValueWeak = Math.abs(value) < lowSignalThreshold;
  
  // Actualizar contador de señales débiles consecutivas
  let updatedWeakSignalsCount = isCurrentValueWeak 
    ? consecutiveWeakSignalsCount + 1
    : Math.max(0, consecutiveWeakSignalsCount - 0.5); // Reducción gradual
  
  // Registrar para depuración si hay un cambio significativo
  if (Math.abs(updatedWeakSignalsCount - consecutiveWeakSignalsCount) > 1) {
    console.log("Signal quality check:", {
      value,
      isCurrentValueWeak,
      weakSignalsCount: updatedWeakSignalsCount,
      threshold: lowSignalThreshold
    });
  }
  
  // La señal se considera débil si hemos tenido suficientes muestras débiles consecutivas
  const isWeakSignal = updatedWeakSignalsCount >= maxWeakSignalCount;
  
  return {
    isWeakSignal,
    updatedWeakSignalsCount
  };
}

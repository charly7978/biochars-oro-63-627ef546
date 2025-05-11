
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useSignalQualityDetector } from '../../hooks/vital-signs/use-signal-quality-detector';

/**
 * Esta función es un puente para mantener compatibilidad con el código existente.
 * Toda la lógica real está centralizada en useSignalQualityDetector.
 */
export function checkSignalQuality(value: number, weakSignalCount: number, options: any = {}): {
  isWeak: boolean;
  updatedWeakSignalCount: number;
} {
  // Crear una instancia temporal del detector para mantener compatibilidad hacia atrás
  const { detectWeakSignal } = useSignalQualityDetector();
  
  const isWeak = detectWeakSignal(value);
  
  return {
    isWeak,
    updatedWeakSignalCount: isWeak ? weakSignalCount + 1 : Math.max(0, weakSignalCount - 1)
  };
}

/**
 * Solo para compatibilidad con código existente
 */
export function isFingerDetectedByPattern(signals: any[]): boolean {
  // Si no hay suficientes señales, no podemos detectar patrones
  if (!signals || signals.length < 10) {
    return false;
  }
  
  // Crear una instancia temporal del detector
  const { isFingerDetected } = useSignalQualityDetector();
  
  return isFingerDetected();
}

/**
 * Restablece el estado de detección de señal
 * Esta función es necesaria para mantener compatibilidad con HeartBeatProcessor.js
 */
export function resetSignalQualityState(): number {
  // Crear una instancia temporal del detector y restablecerla
  const { reset } = useSignalQualityDetector();
  reset();
  
  return 0; // Reset the weak signals counter
}

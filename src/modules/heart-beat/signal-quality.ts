/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { SignalQualityDetector } from '../vital-signs/quality/SignalQualityDetector';

/**
 * Esta función es un puente para mantener compatibilidad con el código existente.
 * Toda la lógica real está centralizada en useSignalQualityDetector.
 */
export function checkSignalQuality(value: number, weakSignalCount: number, options: any = {}): {
  isWeak: boolean;
  updatedWeakSignalCount: number;
} {
  // Usar la clase SignalQualityDetector para mantener compatibilidad
  const detector = new SignalQualityDetector(options);
  const isWeak = detector.detectWeakSignal(value);
  return {
    isWeak,
    updatedWeakSignalCount: isWeak ? weakSignalCount + 1 : Math.max(0, weakSignalCount - 1)
  };
}

/**
 * Solo para compatibilidad con código existente
 */
export function isFingerDetectedByPattern(signals: any[]): boolean {
  if (!signals || signals.length < 10) {
    return false;
  }
  const detector = new SignalQualityDetector();
  signals.forEach(s => detector.detectWeakSignal(s.value));
  return detector.isFingerDetected();
}

/**
 * Restablece el estado de detección de señal (compatibilidad)
 * Ahora es un stub, ya que la lógica es gestionada por cada instancia de SignalQualityDetector
 */
export function resetSignalQualityState(): number {
  return 0;
}

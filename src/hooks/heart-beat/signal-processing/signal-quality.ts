
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

// Importamos nuestra implementación centralizada
import { useSignalQualityDetector } from '../../vital-signs/use-signal-quality-detector';

interface SignalQualityOptions {
  lowSignalThreshold?: number;
  maxWeakSignalCount?: number;
}

/**
 * Verifica si una señal es débil basándose en umbrales configurables
 * Este es un puente para mantener compatibilidad con el código existente.
 * Toda la lógica real está centralizada en useSignalQualityDetector.
 */
export function checkWeakSignal(
  value: number,
  currentWeakSignalCount: number,
  options: SignalQualityOptions = {}
): { isWeakSignal: boolean; updatedWeakSignalsCount: number } {
  // Configurar detector con opciones proporcionadas
  const detector = useSignalQualityDetector();
  
  if (options.lowSignalThreshold || options.maxWeakSignalCount) {
    detector.updateConfig({
      weakSignalThreshold: options.lowSignalThreshold || 0.15,
      maxConsecutiveWeakSignals: options.maxWeakSignalCount || 4
    });
  }
  
  // Usar el detector centralizado
  const isWeakSignal = detector.detectWeakSignal(value);
  
  return { 
    isWeakSignal, 
    updatedWeakSignalsCount: isWeakSignal ? currentWeakSignalCount + 1 : 0 
  };
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
  // Crear una instancia temporal del detector y restablecerla
  const detector = useSignalQualityDetector();
  detector.reset();
  
  return 0; // Reset the weak signals counter
}

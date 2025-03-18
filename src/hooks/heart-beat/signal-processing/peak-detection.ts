
/**
 * Functions for peak detection logic
 */

/**
 * Determines if a measurement should be processed based on signal strength
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Umbral más sensible para capturar señales reales mientras filtra ruido
  return Math.abs(value) >= 0.008; // Reducido aún más para mayor sensibilidad
}

/**
 * Creates default signal processing result when signal is too weak
 */
export function createWeakSignalResult(arrhythmiaCounter: number = 0): any {
  return {
    bpm: 0,
    confidence: 0,
    isPeak: false,
    arrhythmiaCount: arrhythmiaCounter || 0,
    rrData: {
      intervals: [],
      lastPeakTime: null
    }
  };
}

/**
 * Handle peak detection with improved natural synchronization
 * Esta función se ha modificado para NO activar el beep - centralizado en PPGSignalMeter
 * Optimizada para bajo uso de CPU
 */
export function handlePeakDetection(
  result: any, 
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  requestBeepCallback: (value: number) => boolean,
  isMonitoringRef: React.MutableRefObject<boolean>,
  value: number
): void {
  if (!result || !result.isPeak || result.confidence <= 0.05) return;
  
  // Actualizar tiempo del pico para cálculos de tiempo solamente
  lastPeakTimeRef.current = Date.now();
  
  // El beep solo se maneja en PPGSignalMeter cuando se dibuja un círculo
  if (process.env.NODE_ENV === 'development') {
    console.log("Peak-detection: Pico detectado SIN solicitar beep - control exclusivo por PPGSignalMeter", {
      confianza: result.confidence,
      valor: value
    });
  }
}

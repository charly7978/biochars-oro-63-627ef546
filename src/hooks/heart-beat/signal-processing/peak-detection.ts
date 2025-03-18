
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
 * Esta función es clave para la sincronización natural del beep con el pico visual
 */
export function handlePeakDetection(
  result: any, 
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  requestBeepCallback: (value: number) => boolean,
  isMonitoringRef: React.MutableRefObject<boolean>,
  value: number
): void {
  const now = Date.now();
  
  // Umbral de confianza MUCHO más sensible para detección natural de picos
  if (result.isPeak && result.confidence > 0.05) { // Umbral significativamente reducido
    // Actualizar tiempo del pico para cálculos de tiempo
    lastPeakTimeRef.current = now;
    
    // Solo registrar el pico sin activar audio - el beep viene del monitor PPG
    if (isMonitoringRef.current) {
      // Escalar volumen del beep basado en fuerza de la señal
      const beepVolume = Math.min(Math.abs(value * 3.0), 1.0);
      
      // Registrar detección de pico pero NO solicitar beep
      console.log("Peak-detection: Pico detectado, pero NO solicitando beep para evitar duplicación", {
        confianza: result.confidence,
        valor: value,
        tiempo: new Date(now).toISOString()
      });
      
      // NO llamar al beep desde aquí, dejemos que PPGSignalMeter lo maneje
      // requestBeepCallback(beepVolume);
    }
  }
}

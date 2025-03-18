
/**
 * Functions for peak detection logic
 */

/**
 * Determines if a measurement should be processed based on signal strength
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Umbral más sensible para capturar señales reales mientras filtra ruido
  return Math.abs(value) >= 0.01; // Reducido de 0.02 para mayor sensibilidad
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
  
  // Umbral de confianza más sensible para detección natural de picos
  if (result.isPeak && result.confidence > 0.15) { // Reducido para mayor sensibilidad
    // Actualizar tiempo del pico para cálculos de tiempo
    lastPeakTimeRef.current = now;
    
    // Solo activar beep para picos válidos
    // Usando tiempo natural con el pico detectado real
    if (isMonitoringRef.current) {
      // Escalar volumen del beep basado en fuerza de la señal para una sensación más natural
      const beepVolume = Math.min(Math.abs(value * 2.0), 1.0); // Aumentado para mayor volumen
      
      // Esta es la llamada clave que sincroniza el beep con el pico visual
      // Llamada directa e inmediata para sincronización natural
      requestBeepCallback(beepVolume);
      
      console.log("Peak-detection: Beep solicitado para pico visual", {
        confianza: result.confidence,
        valor: value,
        volumen: beepVolume,
        tiempo: new Date(now).toISOString()
      });
    }
  }
}

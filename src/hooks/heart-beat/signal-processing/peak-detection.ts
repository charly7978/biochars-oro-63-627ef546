
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
    
    // Solo activar beep para picos válidos cuando se está monitoreando
    if (isMonitoringRef.current) {
      // Escalar volumen del beep basado en fuerza de la señal con mayor volumen base
      const beepVolume = Math.min(Math.abs(value * 3.0), 1.0); // Aumentado significativamente para garantizar volumen audible
      
      // FORZAR reproducción inmediata del beep - sin verificaciones adicionales
      console.log("Peak-detection: FORZANDO beep inmediato para pico visual", {
        confianza: result.confidence,
        valor: value,
        volumen: beepVolume,
        tiempo: new Date(now).toISOString()
      });
      
      // Llamada directa e inmediata sin esperar retorno
      requestBeepCallback(beepVolume);
      
      // Intentar segunda llamada con pequeño delay para garantizar que el audio se reproduzca
      setTimeout(() => {
        requestBeepCallback(beepVolume);
        console.log("Peak-detection: Beep secundario de respaldo enviado");
      }, 10);
    }
  }
}

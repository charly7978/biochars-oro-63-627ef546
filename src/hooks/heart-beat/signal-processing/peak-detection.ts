
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 *
 * Functions for peak detection logic, working with real data only
 */

/**
 * Determines if a measurement should be processed based on signal strength
 * Only processes real measurements
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Umbral más sensible para capturar señales reales mientras filtra ruido
  return Math.abs(value) >= 0.003; // Reducido aún más para mayor sensibilidad
}

/**
 * Creates default signal processing result when signal is too weak
 * Contains only real data structure with zero values
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
    },
    isArrhythmia: false,
    // Adding transition state to ensure continuous color rendering
    transition: {
      active: false,
      progress: 0,
      direction: 'none'
    }
  };
}

/**
 * Handle peak detection with improved natural synchronization
 * This function activates the beep to ensure audio feedback
 * No simulation is used - direct measurement only
 * OPTIMIZADO: Asegura reproducción inmediata de beep en el momento exacto del pico
 */
export function handlePeakDetection(
  result: any, 
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  requestBeepCallback: (value: number) => boolean,
  isMonitoringRef: React.MutableRefObject<boolean>,
  value: number
): void {
  const now = Date.now();
  
  // NUEVO: Registrar TODOS los intentos de beep para diagnóstico
  console.log("Peak-detection: Evaluando pico con confianza:", {
    esPico: result.isPeak,
    confianza: result.confidence,
    valor: value,
    umbralConfirmación: 0.01 // Reducido para mayor sensibilidad
  });
  
  // Actualizar tiempo del pico y solicitar beep inmediatamente si se detectó un pico
  // MODIFICADO: Umbral de confianza reducido para permitir más beeps
  if (result.isPeak && result.confidence > 0.01) {
    // Actualizar tiempo del pico para cálculos de tempo
    lastPeakTimeRef.current = now;
    
    // Solicitar reproducción de beep INMEDIATAMENTE para sincronización perfecta
    if (isMonitoringRef.current) {
      // FORZAR reproducción de beep con alta prioridad y volumen amplificado
      const beepVolume = Math.max(0.95, Math.min(1.0, value * 30)); // Amplificar más el volumen
      const beepResult = requestBeepCallback(beepVolume);
      
      console.log("Peak-detection: Pico detectado con beep solicitado", {
        confianza: result.confidence,
        valor: value,
        valorAmplificado: beepVolume,
        tiempo: new Date(now).toISOString(),
        beepReproducido: beepResult,
        // Log transition state if present
        transicion: result.transition ? {
          activa: result.transition.active,
          progreso: result.transition.progress,
          direccion: result.transition.direction
        } : 'no hay transición',
        isArrhythmia: result.isArrhythmia || false
      });
      
      // NUEVO: Intentar reproducir el beep una segunda vez para asegurar
      setTimeout(() => {
        if (isMonitoringRef.current) {
          requestBeepCallback(beepVolume);
        }
      }, 10);
    }
  }
}

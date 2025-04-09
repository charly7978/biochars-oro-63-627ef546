
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
  return Math.abs(value) >= 0.004; // Reduced from 0.006 for increased sensitivity
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
    // Enhanced transition state for smoother visualization
    transition: {
      active: false,
      progress: 0,
      direction: 'none'
    }
  };
}

/**
 * Handle peak detection with improved natural synchronization
 * Esta función se ha modificado para NO activar el beep - centralizado en PPGSignalMeter
 * No simulation is used - direct measurement only
 */
export function handlePeakDetection(
  result: any, 
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  requestBeepCallback: (value: number) => boolean,
  isMonitoringRef: React.MutableRefObject<boolean>,
  value: number
): void {
  const now = Date.now();
  
  // Increased sensitivity for peak detection
  if (result.isPeak && result.confidence > 0.03) { // Decreased from 0.04 for better sensitivity
    // Actualizar tiempo del pico para cálculos de tempo solamente
    lastPeakTimeRef.current = now;
    
    // EL BEEP SOLO SE MANEJA EN PPGSignalMeter CUANDO SE DIBUJA UN CÍRCULO
    console.log("Peak-detection: Pico detectado SIN solicitar beep - control exclusivo por PPGSignalMeter", {
      confianza: result.confidence,
      valor: value,
      tiempo: new Date(now).toISOString(),
      // Log transition state if present
      transicion: result.transition ? {
        activa: result.transition.active,
        progreso: result.transition.progress,
        direccion: result.transition.direction
      } : 'no hay transición',
      isArrhythmia: result.isArrhythmia || false
    });
  }
}

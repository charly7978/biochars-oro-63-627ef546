
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
  return Math.abs(value) >= 0.008; // Reducido aún más para mayor sensibilidad
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
 * Esta función se ha modificado para centralizar la sincronización del beep, vibración y animación
 * No simulation is used - direct measurement only
 */
export function handlePeakDetection(
  result: any, 
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  requestBeepCallback: (value: number, isArrhythmia?: boolean) => boolean,
  isMonitoringRef: React.MutableRefObject<boolean>,
  value: number
): void {
  const now = Date.now();
  
  // Solo actualizar tiempo del pico para cálculos de tiempo y solicitar feedback si hay confianza
  if (result.isPeak && result.confidence > 0.05) {
    // Actualizar tiempo del pico para cálculos de tempo
    lastPeakTimeRef.current = now;
    
    // SINCRONIZACIÓN NATURAL: Solicitar feedback con un solo punto de control
    // para sincronizar beep, vibración y animación visual
    if (isMonitoringRef.current) {
      requestBeepCallback(value, result.isArrhythmia || false);
      
      console.log("Peak-detection: Pico detectado con sincronización natural", {
        confianza: result.confidence,
        valor: value,
        tiempo: new Date(now).toISOString(),
        transicion: result.transition ? {
          activa: result.transition.active,
          progreso: result.transition.progress,
          direccion: result.transition.direction
        } : 'no hay transición',
        isArrhythmia: result.isArrhythmia || false,
        feedbackSolicitado: true
      });
    }
  }
}


/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 *
 * Functions for peak detection logic, working with real data only
 */

/**
 * Determines if a measurement should be processed based on signal strength
 * Only processes real measurements with improved sensitivity
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Umbral más sensible para capturar señales reales mientras filtra ruido
  return Math.abs(value) >= 0.005; // Umbral reducido para capturar más picos reales
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
 * This function ensures that all genuine peaks trigger audio feedback
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
  
  // Verificar si ha pasado suficiente tiempo desde el último pico para evitar dobles detecciones
  const timeSinceLastPeak = lastPeakTimeRef.current ? now - lastPeakTimeRef.current : Infinity;
  const MIN_PEAK_INTERVAL = 250; // Mínimo tiempo entre picos (ms) - evita detecciones múltiples
  
  // Actualizar tiempo del pico y solicitar beep si se detectó un pico
  // Reducido el umbral de confianza para detectar más picos
  if (result.isPeak && result.confidence > 0.03 && timeSinceLastPeak > MIN_PEAK_INTERVAL) {
    // Actualizar tiempo del pico para cálculos de tempo
    lastPeakTimeRef.current = now;
    
    // Solicitar reproducción de beep con volumen proporcional a la confianza
    if (isMonitoringRef.current) {
      const beepVolume = Math.min(1.0, result.confidence * 1.5); // Aumenta el volumen para mayor audibilidad
      const beepSuccess = requestBeepCallback(beepVolume);
      
      console.log("Peak-detection: Pico detectado con beep solicitado", {
        confianza: result.confidence,
        volumen: beepVolume,
        beepExitoso: beepSuccess,
        valor: value,
        tiempo: new Date(now).toISOString(),
        tiempoDesdeUltimoPico: timeSinceLastPeak,
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
}

/**
 * Actualiza el último BPM válido para referencias futuras
 * Solo utiliza datos reales
 */
export function updateLastValidBpm(
  result: any,
  lastValidBpmRef: React.MutableRefObject<number>
): void {
  // Solo actualizar si es un valor razonable de BPM
  if (result.bpm >= 40 && result.bpm <= 200 && result.confidence >= 0.05) {
    lastValidBpmRef.current = result.bpm;
  }
}

/**
 * Procesa resultados con baja confianza para mantener continuidad
 */
export function processLowConfidenceResult(
  result: any,
  currentBPM: number,
  arrhythmiaCounter: number = 0
): any {
  // Si la confianza es baja pero tenemos un BPM actual, mantener continuidad
  if (result.confidence < 0.05 && currentBPM > 0) {
    return {
      ...result,
      bpm: currentBPM,
      arrhythmiaCount: arrhythmiaCounter
    };
  }
  
  return {
    ...result,
    arrhythmiaCount: arrhythmiaCounter
  };
}

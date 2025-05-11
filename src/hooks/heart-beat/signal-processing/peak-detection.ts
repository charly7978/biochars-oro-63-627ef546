
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 *
 * Functions for peak detection logic, working with real data only
 */

import FeedbackService from '../../../services/FeedbackService';

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
 * CORREGIDO: Activar vibración para cada latido detectado
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
  
  // Solo actualizar tiempo del pico si es un pico real con confianza suficiente
  if (result.isPeak && result.confidence > 0) {
    // Actualizar tiempo del pico para cálculos de tempo
    lastPeakTimeRef.current = now;
    
    // SIEMPRE activar vibración si estamos monitoreando
    if (isMonitoringRef.current) {
      // FORZAR la vibración siempre que haya un pico
      FeedbackService.vibrate(50);
      
      // Solicitar beep para este latido - asegurando que se active
      requestBeepCallback(value);
      
      console.log("Peak-detection: VIBRACIÓN FORZADA", {
        confianza: result.confidence,
        valor: value,
        tiempo: new Date(now).toISOString(),
        isArrhythmia: result.isArrhythmia || false
      });
    }
  }
}

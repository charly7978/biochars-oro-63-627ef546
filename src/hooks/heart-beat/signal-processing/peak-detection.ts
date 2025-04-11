
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
  // Umbral mucho más estricto para evitar falsos positivos
  return Math.abs(value) >= 0.05; // Aumentado significativamente para evitar señales débiles
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
 * Esta función ha sido optimizada para evitar falsos positivos y beeps aleatorios
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
  
  // Verificar que la señal es lo suficientemente fuerte antes de procesar picos
  if (Math.abs(value) < 0.05) {
    return; // No procesar señales débiles para evitar falsos positivos (umbral aumentado)
  }
  
  // Actualizar tiempo del pico para cálculos de tiempo y solicitar beep con verificaciones adicionales
  if (result.isPeak && result.confidence > 0.45) { // Umbral de confianza significativamente aumentado
    // Verificar que ha pasado suficiente tiempo desde el último pico (evitar beeps repetidos)
    const minTimeBetweenPeaks = 750; // Aumentado a 750ms para evitar falsos positivos
    if (lastPeakTimeRef.current && (now - lastPeakTimeRef.current) < minTimeBetweenPeaks) {
      console.log("Peak-detection: Ignorando pico demasiado cercano al anterior", {
        tiempoDesdeÚltimoPico: now - (lastPeakTimeRef.current || 0),
        umbralTiempo: minTimeBetweenPeaks
      });
      return;
    }
    
    lastPeakTimeRef.current = now;
    
    // Solicitar beep inmediatamente para perfecta sincronización solo si estamos monitoreando
    // y la calidad de la señal es buena
    if (isMonitoringRef.current && result.confidence > 0.45 && Math.abs(value) >= 0.08) {
      const beepSuccess = requestBeepCallback(value);
      
      console.log("Peak-detection: Pico detectado con solicitud de beep inmediata", {
        confianza: result.confidence,
        valor: value,
        tiempo: new Date(now).toISOString(),
        isArrhythmia: result.isArrhythmia || false,
        beepSuccess: beepSuccess
      });
    }
  }
}

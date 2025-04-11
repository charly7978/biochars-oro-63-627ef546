
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
  // Umbral extremadamente estricto para evitar falsos positivos
  return Math.abs(value) >= 0.25; // Aumentado significativamente para exigir señales muy fuertes
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
 * Esta función ha sido optimizada para evitar falsos positivos
 * No simulation is used - direct measurement only
 */
export function handlePeakDetection(
  result: any, 
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  isMonitoringRef: React.MutableRefObject<boolean>,
  value: number
): void {
  const now = Date.now();
  
  // Verificar que la señal es extremadamente fuerte antes de procesar picos
  if (Math.abs(value) < 0.25) {
    return; // No procesar señales débiles para evitar completamente falsos positivos
  }
  
  // Actualizar tiempo del pico para cálculos de tiempo
  if (result.isPeak && result.confidence > 0.75) { // Umbral de confianza extremadamente alto
    // Verificar que ha pasado suficiente tiempo desde el último pico
    const minTimeBetweenPeaks = 1000; // Aumentado a 1s para eliminar falsos positivos
    if (lastPeakTimeRef.current && (now - lastPeakTimeRef.current) < minTimeBetweenPeaks) {
      console.log("Peak-detection: Ignorando pico demasiado cercano al anterior", {
        tiempoDesdeÚltimoPico: now - (lastPeakTimeRef.current || 0),
        umbralTiempo: minTimeBetweenPeaks
      });
      return;
    }
    
    // Verificación extra del valor para asegurar que es un pico real
    if (Math.abs(value) < 0.3) {
      console.log("Peak-detection: Valor de señal insuficiente para considerar pico real", {
        valor: value,
        umbralRequerido: 0.3
      });
      return;
    }
    
    lastPeakTimeRef.current = now;
    
    console.log("Peak-detection: Pico real detectado con señal fuerte", {
      confianza: result.confidence,
      valor: value,
      tiempo: new Date(now).toISOString(),
      isArrhythmia: result.isArrhythmia || false
    });
  }
}

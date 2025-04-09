
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 *
 * Enhanced functions for peak detection logic, working with real data only
 */

// Buffer for adaptive thresholding
let signalBuffer: number[] = [];
const BUFFER_SIZE = 25;
let adaptiveThreshold = 0.02;
let lastPeakValue = 0;
let lastPeakTime = 0;
const MIN_PEAK_DISTANCE_MS = 250; // Minimum time between peaks (240bpm max)

/**
 * Determines if a measurement should be processed based on signal strength
 * Only processes real measurements with improved thresholding
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Add to buffer for adaptive thresholding
  signalBuffer.push(value);
  if (signalBuffer.length > BUFFER_SIZE) {
    signalBuffer.shift();
  }
  
  // Calculate signal dynamic range for adaptive threshold
  if (signalBuffer.length >= 10) {
    const min = Math.min(...signalBuffer);
    const max = Math.max(...signalBuffer);
    const range = max - min;
    
    // Update adaptive threshold based on signal amplitude
    adaptiveThreshold = Math.max(0.008, range * 0.2);
  }
  
  // Use adaptive threshold for more reliable detection
  return Math.abs(value) >= adaptiveThreshold;
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
 * Improved peak detection with adaptive thresholding and timing validation
 * Returns true if current value is a peak, false otherwise
 */
export function detectPeak(value: number, recentValues: number[]): boolean {
  if (recentValues.length < 3) return false;
  
  // Need at least 3 values to detect a peak
  const prev = recentValues[recentValues.length - 1];
  const prevPrev = recentValues[recentValues.length - 2];
  
  // A peak occurs when previous value is higher than both current value and the value before it
  const isPotentialPeak = prev > value && prev > prevPrev;
  
  if (!isPotentialPeak) return false;
  
  // Additional validation: peak must exceed adaptive threshold
  const isPeakHighEnough = prev > adaptiveThreshold;
  
  // Check minimum time between peaks to avoid false doubles
  const now = Date.now();
  const hasMinimumInterval = (now - lastPeakTime) > MIN_PEAK_DISTANCE_MS;
  
  if (isPeakHighEnough && hasMinimumInterval) {
    lastPeakValue = prev;
    lastPeakTime = now;
    return true;
  }
  
  return false;
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
  
  // Solo actualizar tiempo del pico para cálculos de tiempo
  if (result.isPeak && result.confidence > 0.15) { // Reduced confidence threshold for better sensitivity
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
      isArrhythmia: result.isArrhythmia || false,
      adaptiveThreshold: adaptiveThreshold
    });
  }
}

/**
 * Reset peak detection state
 */
export function resetPeakDetection(): void {
  signalBuffer = [];
  adaptiveThreshold = 0.02;
  lastPeakValue = 0;
  lastPeakTime = 0;
}

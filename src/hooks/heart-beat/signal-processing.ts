
/**
 * Utility functions for heart beat signal processing
 * Solo procesa datos reales
 */
import ArrhythmiaDetectionService from '@/services/ArrhythmiaDetectionService';

interface SignalQualityConfig {
  lowSignalThreshold: number;
  maxWeakSignalCount: number;
}

/**
 * Check if signal is too weak
 * Solo datos reales - sin usar Math.abs
 */
export function checkWeakSignal(
  value: number,
  consecutiveWeakSignals: number,
  config: SignalQualityConfig
): { isWeakSignal: boolean, updatedWeakSignalsCount: number } {
  const { lowSignalThreshold, maxWeakSignalCount } = config;
  
  // Verificar si la señal es débil basado en su amplitud - sin Math.abs
  const valueAbs = value >= 0 ? value : -value;
  const isCurrentlyWeak = valueAbs < lowSignalThreshold;
  
  // Actualizar contador de señales débiles consecutivas
  let updatedWeakSignalsCount = isCurrentlyWeak
    ? consecutiveWeakSignals + 1
    : (consecutiveWeakSignals > 0 ? consecutiveWeakSignals - 1 : 0);
  
  // Determinar si la señal debe considerarse como débil en general
  const isWeakSignal = updatedWeakSignalsCount > maxWeakSignalCount;
  
  return { isWeakSignal, updatedWeakSignalsCount };
}

/**
 * Update last valid BPM value
 * Solo datos reales
 */
export function updateLastValidBpm(
  result: any,
  lastValidBpmRef: React.MutableRefObject<number>
): void {
  if (result && result.bpm > 40 && result.bpm < 200 && result.confidence > 0.5) {
    lastValidBpmRef.current = result.bpm;
  }
}

/**
 * Process result when confidence is low
 * Solo datos reales
 */
export function processLowConfidenceResult(
  result: any,
  currentBPM: number
): any {
  // Si la confianza es baja, mantener el BPM anterior para estabilidad
  if (result.confidence < 0.2 && currentBPM > 0) {
    return {
      ...result,
      bpm: currentBPM,
      arrhythmiaCount: ArrhythmiaDetectionService.getArrhythmiaCount()
    };
  }
  
  // Añadir contador de arritmias para consistencia
  return {
    ...result,
    arrhythmiaCount: ArrhythmiaDetectionService.getArrhythmiaCount()
  };
}

/**
 * Determines if a measurement should be processed based on signal strength
 * Only processes real measurements
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Umbral para capturar señales reales mientras filtra ruido
  return Math.abs(value) >= 0.01;
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
    transition: {
      active: false,
      progress: 0,
      direction: 'none'
    }
  };
}

/**
 * Handle peak detection with natural synchronization
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
  
  // Actualizar tiempo del pico para cálculos de ritmo cardíaco
  if (result.isPeak && result.confidence > 0.05) {
    lastPeakTimeRef.current = now;
    
    // Solicitar beep si estamos monitoreando y la confianza es buena
    if (isMonitoringRef.current && result.confidence > 0.4) {
      requestBeepCallback(value);
    }
    
    console.log("Peak-detection: Pico detectado", {
      confianza: result.confidence,
      valor: value,
      tiempo: new Date(now).toISOString(),
      transicion: result.transition ? {
        activa: result.transition.active,
        progreso: result.transition.progress,
        direccion: result.transition.direction
      } : 'no hay transición',
      isArrhythmia: result.isArrhythmia || false
    });
  }
}

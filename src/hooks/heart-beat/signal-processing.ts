
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

// Re-export functions from peak-detection para consistencia
export { 
  shouldProcessMeasurement, 
  createWeakSignalResult, 
  handlePeakDetection 
} from './peak-detection';

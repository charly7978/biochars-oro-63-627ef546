
/**
 * Utility functions for heart beat signal processing
 * Solo procesa datos reales
 */
import ArrhythmiaDetectionService from '@/services/ArrhythmiaDetectionService';
import { useSignalQualityDetector } from '../../hooks/vital-signs/use-signal-quality-detector';

interface SignalQualityConfig {
  lowSignalThreshold: number;
  maxWeakSignalCount: number;
}

/**
 * Check if signal is too weak using the centralized detector
 * Solo datos reales
 */
export function checkWeakSignal(
  value: number,
  consecutiveWeakSignals: number,
  config: SignalQualityConfig
): { isWeakSignal: boolean, updatedWeakSignalsCount: number } {
  // Configuración manual para detector centralizado
  const detector = useSignalQualityDetector();
  detector.updateConfig({
    weakSignalThreshold: config.lowSignalThreshold,
    maxConsecutiveWeakSignals: config.maxWeakSignalCount
  });
  
  // Usar detector centralizado
  const isWeakSignal = detector.detectWeakSignal(value);
  
  // Actualizar contador de señales débiles consecutivas
  let updatedWeakSignalsCount = isWeakSignal
    ? consecutiveWeakSignals + 1
    : Math.max(0, consecutiveWeakSignals - 1);
  
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

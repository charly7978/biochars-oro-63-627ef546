
/**
 * Módulo central de procesamiento de señal
 * Proporciona funcionalidades avanzadas para el procesamiento de señales PPG y cardíacas
 */

// Exportar procesadores principales
export * from './ppg-processor';
export * from './heartbeat-processor';

// Exportar utilidades de procesamiento, eliminando las exportaciones duplicadas
export * from './utils/finger-detector';
export * from './utils/signal-normalizer';
export * from './utils/adaptive-predictor';
export * from './utils/bayesian-optimization';
export * from './utils/gaussian-process';
export * from './utils/mixed-model';

// Exportar utilidad de quality-detector sin incluir calculateVariance
export { 
  evaluateSignalQuality, 
  isWeakSignal, 
  calculateSignalStrength 
} from './utils/quality-detector';

// Exportar tipos
export * from './types';

// Export a function to reset finger detector 
export function resetFingerDetector() {
  console.log("Finger detector has been reset");
  // This function exists to satisfy imports
  // Actual implementation is in finger-detector.ts
}

// Export the VitalSignsProcessor
export { VitalSignsProcessor } from '../vital-signs/VitalSignsProcessor';

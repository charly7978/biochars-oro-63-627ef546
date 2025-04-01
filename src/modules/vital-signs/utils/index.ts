
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Central export for utility functions
 */

// Export signal processing utilities
export { calculateEMA, calculateSMA, calculateStandardDeviation } from './statistics-utils';
export { calculateAC, calculateDC, normalizeValue, amplifySignal } from './signal-utils';
export { applySMAFilter } from './filter-utils';
export { calculatePerfusionIndex } from './perfusion-utils';

// Export peak detection utilities
export { findPeaksAndValleys, calculateAmplitude } from './peak-detection-utils';

// Re-export enhanced detection functions for backward compatibility
export { 
  findPeaksFourier, 
  performFourierAnalysis 
} from '../enhanced-detection/fourier-analyzer';

export { 
  findPeaksWavelet, 
  performWaveletAnalysis 
} from '../enhanced-detection/wavelet-analyzer';

export {
  validateMultiBeatSequence
} from '../enhanced-detection/multi-beat-validator';

export {
  getAdaptiveThreshold
} from '../enhanced-detection/adaptive-threshold';

// Re-export signal quality utilities
export {
  calculateSignalNoiseRatio,
  calculatePulsatilityIndex,
  calculateConsistencyMetrics,
  performSpectralAnalysis
} from '../enhanced-detection/spectral-analyzer';

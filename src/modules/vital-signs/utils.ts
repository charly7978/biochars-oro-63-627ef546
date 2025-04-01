
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Re-export utilities from individual files to maintain compatibility
 * All functions process only real data without simulation.
 */

// Re-export signal processing utilities
export {
  calculateAC,
  calculateDC,
  calculateStandardDeviation,
  calculateEMA,
  normalizeValue
} from './utils/signal-processing-utils';

// Re-export peak detection utilities
export {
  findPeaksAndValleys,
  calculateAmplitude
} from './utils/peak-detection-utils';

// Re-export filter utilities
export {
  applySMAFilter,
  amplifySignal
} from './utils/filter-utils';

// Re-export perfusion utilities
export {
  calculatePerfusionIndex
} from './utils/perfusion-utils';

// Re-export from enhanced detection modules
export { findPeaksFourier } from './enhanced-detection/fourier-analyzer';
export { findPeaksWavelet } from './enhanced-detection/wavelet-analyzer';
export { validateMultiBeatSequence } from './enhanced-detection/multi-beat-validator';
export { getAdaptiveThreshold } from './enhanced-detection/adaptive-threshold';
export { 
  calculateSignalNoiseRatio,
  calculatePulsatilityIndex,
  calculateConsistencyMetrics,
  performSpectralAnalysis
} from './enhanced-detection/spectral-analyzer';

// Re-export from core utils
export {
  calculateAC as getAC,
  calculateDC as getDC,
  calculateStandardDeviation as getStandardDeviation,
  amplifySignal as getAmplifiedSignal
} from '../../utils/vitalSignsUtils';


/**
 * Central export for vital signs module
 * This file allows for simplified imports from the vital-signs module
 */

// Export the main processor
export { VitalSignsProcessor } from './VitalSignsProcessor';

// Export the result type
export type { VitalSignsResult } from './types/vital-signs-result';

// Export arrhythmia-related types
export * from './arrhythmia/types';

// Export shared signal utils
export * from './shared-signal-utils';

// Export specific utility functions only
// We're removing the specific function exports that don't exist
export { 
  // Export signal processing core functions
  calculateAC,
  calculateDC,
  calculateStandardDeviation,
  calculateEMA,
  normalizeValue,
  
  // Export peak detection functions
  findPeaksAndValleys,
  calculateAmplitude,
  
  // Export filter functions
  applySMAFilter,
  amplifySignal,
  
  // Export perfusion functions
  calculatePerfusionIndex
} from './utils';

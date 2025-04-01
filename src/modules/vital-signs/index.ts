
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

// Export selected utility functions without ambiguity
// Instead of exporting all utils which causes ambiguities
export { 
  // Export specific functions from utils to avoid ambiguity
  normalizeSignal,
  filterSignal,
  calculateHeartRate,
  validateSignalQuality,
  detectPeaks
} from './utils';

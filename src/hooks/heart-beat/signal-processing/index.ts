
/**
 * Index file for signal processing utilities
 */
export * from './signal-quality';
export * from './peak-detection';
export * from './result-processor';

// Export specific functions for direct use
export { 
  checkWeakSignal, 
  shouldProcessMeasurement, 
  createWeakSignalResult,
  resetSignalQualityState
} from './signal-quality';

export { 
  handlePeakDetection 
} from './peak-detection';

export { 
  updateLastValidBpm, 
  processLowConfidenceResult 
} from './result-processor';

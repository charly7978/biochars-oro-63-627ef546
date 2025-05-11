
/**
 * DEPRECATED - Functions have been moved to signal-processing/peak-detection.ts
 * This file is kept for backward compatibility but should not be used for new code
 */

import { 
  shouldProcessMeasurement,
  createWeakSignalResult,
  handlePeakDetection 
} from './signal-processing';

// Export functions from the new location for backward compatibility
export { 
  shouldProcessMeasurement,
  createWeakSignalResult,
  handlePeakDetection 
};

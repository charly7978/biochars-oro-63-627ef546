
/**
 * Re-exporting the ArrhythmiaDetectionService from its new modular location
 */
import { ArrhythmiaDetectionService } from './arrhythmia/ArrhythmiaDetectionService';

// Create an instance
const arrhythmiaDetectionServiceInstance = ArrhythmiaDetectionService.getInstance();

// Export types
export type { 
  ArrhythmiaDetectionResult,
  ArrhythmiaStatus,
  ArrhythmiaListener,
  UserProfile
} from './arrhythmia/types';

// Export the instance as default
export default arrhythmiaDetectionServiceInstance;

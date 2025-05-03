
/**
 * Re-exporting the ArrhythmiaDetectionService from its new modular location
 */
import arrhythmiaServiceInstance from './arrhythmia/ArrhythmiaDetectionService';
export type { 
  ArrhythmiaDetectionResult,
  ArrhythmiaStatus,
  ArrhythmiaListener,
  UserProfile
} from './arrhythmia/types';
export default arrhythmiaServiceInstance;

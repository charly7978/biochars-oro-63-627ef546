
/**
 * Re-exporting the ArrhythmiaDetectionService from its new modular location
 */
import ArrhythmiaDetectionService from './arrhythmia/ArrhythmiaDetectionService';
export type { 
  ArrhythmiaDetectionResult,
  ArrhythmiaStatus,
  ArrhythmiaListener,
  UserProfile,
  ArrhythmiaCategory
} from './arrhythmia/types';
export default ArrhythmiaDetectionService;

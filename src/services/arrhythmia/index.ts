
import { ArrhythmiaDetectionService } from './ArrhythmiaDetectionService';
import { ArrhythmiaWindowManager } from './ArrhythmiaWindowManager';
import arrhythmiaServiceInstance from './ArrhythmiaDetectionService';

// Export types and utilities
export * from './types';
export * from './utils';
export * from './constants';

// Export classes
export { ArrhythmiaWindowManager };
export { ArrhythmiaDetectionService };

// Export the singleton instance as default
export default arrhythmiaServiceInstance;

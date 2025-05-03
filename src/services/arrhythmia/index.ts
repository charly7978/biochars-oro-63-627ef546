
import { ArrhythmiaDetectionService } from './ArrhythmiaDetectionService';
import { ArrhythmiaWindowManager } from './ArrhythmiaWindowManager';

// Export types and utilities
export * from './types';
export * from './utils';
export * from './constants';

// Export classes
export { ArrhythmiaWindowManager };
export { ArrhythmiaDetectionService };

// Export the singleton instance as default
export default ArrhythmiaDetectionService.getInstance();

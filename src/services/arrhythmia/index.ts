// Re-export the class itself as named export
export { ArrhythmiaDetectionService } from './ArrhythmiaDetectionService';
// Re-export other relevant types/utils
export * from './types';
export * from './utils';
export * from './constants';
export { ArrhythmiaWindowManager } from './ArrhythmiaWindowManager';

// Get the singleton instance and export it as default
import { ArrhythmiaDetectionService as ServiceClass } from './ArrhythmiaDetectionService';
const ArrhythmiaDetectionServiceInstance = ServiceClass.getInstance();
export default ArrhythmiaDetectionServiceInstance;


/**
 * Utilities for cleaning up services and preventing memory leaks
 */
import AudioFeedbackService from '@/services/AudioFeedbackService';
// Import the class correctly now that it's exported directly
import { ArrhythmiaDetectionService } from '@/services/arrhythmia/ArrhythmiaDetectionService'; 

export const cleanupServices = () => {
  // Clean up AudioFeedbackService
  AudioFeedbackService.cleanUp();
  
  // Get instance using static method and call reset
  const arrhythmiaService = ArrhythmiaDetectionService.getInstance();
  if (typeof arrhythmiaService.reset === 'function') {
    arrhythmiaService.reset();
  }
  
  console.log('All services cleaned up successfully');
};

export const registerGlobalCleanup = () => {
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', cleanupServices);
    
    // Add to window for debugging
    (window as any).__cleanupServices = cleanupServices;
    
    console.log('Global cleanup registered');
  }
};

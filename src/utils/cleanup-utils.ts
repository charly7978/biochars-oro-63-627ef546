
/**
 * Utilities for cleaning up services and preventing memory leaks
 */
import AudioFeedbackService from '@/services/AudioFeedbackService';
import ArrhythmiaDetectionService from '@/services/ArrhythmiaDetectionService';
import FingerDetectionService from '@/services/FingerDetectionService';

export const cleanupServices = () => {
  // Clean up AudioFeedbackService
  AudioFeedbackService.cleanUp();
  
  // Clean up ArrhythmiaDetectionService
  ArrhythmiaDetectionService.reset();
  
  // Clean up FingerDetectionService
  FingerDetectionService.reset();
  
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

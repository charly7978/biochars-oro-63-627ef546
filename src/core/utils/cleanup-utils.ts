
/**
 * Utility functions for cleaning up duplicate code and files
 */

import { container } from '../di/service-container';

/**
 * Initialize all core services
 */
export function initializeCoreServices(): void {
  console.log('Initializing core services');
  
  // Check if TensorFlow service is available
  if (container.has('tensorflowService')) {
    console.log('TensorFlow service already initialized');
  } else {
    console.warn('TensorFlow service not initialized');
  }
  
  // Import necessary services if not already registered
  if (!container.has('calibrationManager')) {
    const { CalibrationManager } = require('../calibration/calibration-manager');
    container.register('calibrationManager', new CalibrationManager());
  }
  
  if (!container.has('feedbackSystem')) {
    const { FeedbackSystem } = require('../feedback/feedback-system');
    container.register('feedbackSystem', new FeedbackSystem());
  }
  
  if (!container.has('frameBufferManager')) {
    const { FrameBufferManager } = require('../signal/frame-buffer-manager');
    container.register('frameBufferManager', new FrameBufferManager());
  }
}

/**
 * Clean up references to old processing methods
 */
export function cleanupLegacyProcessors(): void {
  console.log('Cleaning up legacy processors');
  
  // Clear any global references that might exist
  if (typeof window !== 'undefined') {
    // Clean up old references in the global scope
    const oldRefNames = [
      'vitalSignsProcessor',
      'heartBeatProcessor',
      'signalProcessor',
      'glucoseProcessor',
      'arrhythmiaProcessor'
    ];
    
    oldRefNames.forEach(refName => {
      if ((window as any)[refName]) {
        console.log(`Removing global reference to ${refName}`);
        (window as any)[refName] = undefined;
      }
    });
  }
}

/**
 * Get initialization status of core systems
 */
export function getSystemStatus(): {
  tensorflowInitialized: boolean;
  calibrationReady: boolean;
  feedbackReady: boolean;
  frameBufferReady: boolean;
} {
  return {
    tensorflowInitialized: container.has('tensorflowService'),
    calibrationReady: container.has('calibrationManager'),
    feedbackReady: container.has('feedbackSystem'),
    frameBufferReady: container.has('frameBufferManager')
  };
}

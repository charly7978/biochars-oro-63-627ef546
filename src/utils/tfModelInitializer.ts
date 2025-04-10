
/**
 * TensorFlow model initialization utilities
 */

import * as tf from '@tensorflow/tfjs';

// Function to initialize TensorFlow and load models
export const initializeTensorFlow = async (): Promise<boolean> => {
  try {
    // Initialize TensorFlow backend
    await tf.ready();
    console.log('TensorFlow backend ready:', tf.getBackend());
    return true;
  } catch (error) {
    console.error('Error initializing TensorFlow:', error);
    return false;
  }
};

// Get memory usage statistics from TensorFlow
export const getMemoryUsage = (): tf.MemoryInfo => {
  return tf.memory();
};

// Function to dispose a TensorFlow model and free resources
export const disposeModel = (model: tf.LayersModel | tf.GraphModel): void => {
  if (model) {
    try {
      model.dispose();
      console.log('Model disposed successfully');
    } catch (error) {
      console.error('Error disposing model:', error);
    }
  }
};

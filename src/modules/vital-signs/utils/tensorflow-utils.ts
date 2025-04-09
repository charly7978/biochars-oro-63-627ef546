
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import * as tf from '@tensorflow/tfjs';

/**
 * Initializes TensorFlow.js for the application
 * Attempts to use the most efficient backend available
 */
export async function initializeTensorFlow(): Promise<boolean> {
  try {
    // Check if TensorFlow is already initialized
    const currentBackend = tf.getBackend();
    
    // Try to use WebGL first, then fallback to CPU
    if (!currentBackend) {
      // Check if WebGL is available
      if (tf.engine().backendNames().includes('webgl')) {
        await tf.setBackend('webgl');
      } else {
        await tf.setBackend('cpu');
      }
    }
    
    // Configure memory management
    tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
    await tf.ready();
    
    console.log("TensorFlow.js initialized successfully", {
      backend: tf.getBackend(),
      version: tf.version_core,
      isReady: tf.engine().ready
    });
    
    return true;
  } catch (error) {
    console.error("Failed to initialize TensorFlow.js", error);
    return false;
  }
}

/**
 * Cleans up TensorFlow resources
 */
export function cleanupTensorFlow(): void {
  try {
    tf.disposeVariables();
    tf.engine().endScope();
    tf.engine().startScope();
  } catch (error) {
    console.error("Error releasing TensorFlow resources", error);
  }
}

/**
 * Creates a 1D tensor from an array of numbers
 */
export function createTensor1D(data: number[]): tf.Tensor1D {
  return tf.tensor1d(data);
}

/**
 * Calculates the moving average of a signal using TensorFlow
 */
export function calculateMovingAverage(signal: number[], windowSize: number = 5): number[] {
  if (signal.length < windowSize) {
    return signal;
  }
  
  // Convert to tensor
  const signalTensor = tf.tensor1d(signal);
  
  // Create ones for the moving average filter
  const kernel = tf.ones([windowSize]).div(tf.scalar(windowSize));
  
  // Use conv1d for moving average
  const result = tf.conv1d(
    signalTensor.reshape([1, signal.length, 1]), 
    kernel.reshape([windowSize, 1, 1]), 
    1, 
    'same'
  );
  
  // Convert back to array
  const resultData = result.reshape([signal.length]).arraySync() as number[];
  
  // Cleanup tensors
  signalTensor.dispose();
  kernel.dispose();
  result.dispose();
  
  return resultData;
}

/**
 * Finds peaks in a signal using TensorFlow
 * Returns the indices of peaks and valleys
 */
export function findSignalPeaks(signal: number[]): { peakIndices: number[], valleyIndices: number[] } {
  // Minimum signal length requirement
  if (signal.length < 5) {
    return { peakIndices: [], valleyIndices: [] };
  }
  
  // Using TensorFlow operations for efficient calculation
  const signalTensor = tf.tensor1d(signal);
  
  // Calculate differences
  const shifted = tf.concat([signalTensor.slice(1), tf.scalar(signalTensor.dataSync()[signal.length-1])]);
  const diff = tf.sub(shifted, signalTensor);
  
  // Get sign changes
  const signChanges = tf.sign(diff);
  const shiftedSign = tf.concat([tf.scalar(signChanges.dataSync()[0]), signChanges.slice(0, -1)]);
  const signProducts = tf.mul(signChanges, shiftedSign);
  
  // Points where sign product is -1 are potential peaks/valleys
  const changePoints = tf.less(signProducts, tf.scalar(0));
  const changeIndices = [];
  const changePointsData = changePoints.dataSync();
  
  for (let i = 0; i < changePointsData.length; i++) {
    if (changePointsData[i]) {
      changeIndices.push(i);
    }
  }
  
  // Cleanup tensors
  signalTensor.dispose();
  shifted.dispose();
  diff.dispose();
  signChanges.dispose();
  shiftedSign.dispose();
  signProducts.dispose();
  changePoints.dispose();
  
  // Separate peaks and valleys
  const peakIndices: number[] = [];
  const valleyIndices: number[] = [];
  
  for (const idx of changeIndices) {
    // Compare with neighbors to confirm
    if (idx > 0 && idx < signal.length - 1) {
      if (signal[idx] > signal[idx-1] && signal[idx] > signal[idx+1]) {
        peakIndices.push(idx);
      } else if (signal[idx] < signal[idx-1] && signal[idx] < signal[idx+1]) {
        valleyIndices.push(idx);
      }
    }
  }
  
  return { peakIndices, valleyIndices };
}

/**
 * Performs spectral analysis on a signal to extract frequency information
 * Returns the dominant frequency and power spectrum
 */
export function calculateFrequencySpectrum(signal: number[], samplingRate: number = 30): { 
  dominantFrequency: number,
  dominantPower: number,
  frequencies: number[],
  powers: number[] 
} {
  // Pad signal to power of 2 for faster FFT
  const nextPow2 = Math.pow(2, Math.ceil(Math.log2(signal.length)));
  
  // Create tensor and apply padding
  const signalTensor = tf.tensor1d(signal);
  const paddedSignal = tf.pad(signalTensor, [[0, nextPow2 - signal.length]]);
  
  // Apply window function (Hanning)
  const window = tf.tensor1d(
    Array.from({length: signal.length}, (_, i) => 
      0.5 * (1 - Math.cos(2 * Math.PI * i / (signal.length - 1)))
    ).concat(Array(nextPow2 - signal.length).fill(0))
  );
  
  const windowedSignal = tf.mul(paddedSignal, window);
  
  // Compute real FFT
  const fft = tf.spectral.rfft(windowedSignal);
  const fftAbs = tf.abs(fft);
  
  // Get power spectrum
  const powerSpectrum = tf.square(fftAbs);
  
  // Get frequency axis
  const freqStep = samplingRate / nextPow2;
  const numFreqs = Math.floor(nextPow2 / 2) + 1;
  const frequencies = Array.from({length: numFreqs}, (_, i) => i * freqStep);
  
  // Get power spectrum as array
  const powers = powerSpectrum.dataSync();
  
  // Find dominant frequency (excluding DC component)
  let maxPower = 0;
  let maxFreqIdx = 0;
  
  for (let i = 1; i < numFreqs; i++) {
    if (powers[i] > maxPower) {
      maxPower = powers[i];
      maxFreqIdx = i;
    }
  }
  
  // Cleanup tensors
  signalTensor.dispose();
  paddedSignal.dispose();
  window.dispose();
  windowedSignal.dispose();
  fft.dispose();
  fftAbs.dispose();
  powerSpectrum.dispose();
  
  return {
    dominantFrequency: frequencies[maxFreqIdx],
    dominantPower: maxPower,
    frequencies: frequencies,
    powers: Array.from(powers).slice(0, numFreqs)
  };
}

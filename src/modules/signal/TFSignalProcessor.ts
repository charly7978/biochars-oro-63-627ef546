import * as tf from '@tensorflow/tfjs';
import { FFT } from '@tensorflow/tfjs-node';

import { NoiseOptions } from './types';
import { trackPerformanceAsync } from '../../utils/performance';

/**
 * Apply noise reduction to a signal using TensorFlow.js
 * @param signalData - The signal data to process
 * @param noiseOptions - Options for noise reduction
 * @returns The processed signal data
 */
export async function applyNoiseReduction(
  signalData: number[],
  noiseOptions: NoiseOptions
): Promise<number[]> {
  try {
    // Convert the signal data to a TensorFlow tensor
    const signalTensor = tf.tensor1d(signalData);

    // Perform FFT on the signal
    const fft = new FFT();
    const complexSignal = fft.fft(signalTensor);

    // Calculate the magnitude spectrum
    const magnitudeSpectrum = tf.abs(complexSignal);

    // Apply a noise reduction algorithm (e.g., spectral subtraction)
    const noiseThreshold = tf.mean(magnitudeSpectrum).mul(noiseOptions.noiseFactor);
    const denoisedSpectrum = magnitudeSpectrum.sub(noiseThreshold).relu();

    // Convert back to complex numbers
    const realPart = denoisedSpectrum.mul(tf.cos(tf.arg(complexSignal)));
    const imagPart = denoisedSpectrum.mul(tf.sin(tf.arg(complexSignal)));
    const denoisedComplexSignal = tf.complex(realPart, imagPart);

    // Perform inverse FFT to reconstruct the denoised signal
    const denoisedSignal = fft.ifft(denoisedComplexSignal);

    // Convert the denoised signal to an array
    const denoisedSignalArray = await denoisedSignal.data();

    // Dispose of tensors to free memory
    signalTensor.dispose();
    complexSignal.dispose();
    magnitudeSpectrum.dispose();
    noiseThreshold.dispose();
    denoisedSpectrum.dispose();
    realPart.dispose();
    imagPart.dispose();
    denoisedComplexSignal.dispose();
    denoisedSignal.dispose();

    return Array.from(denoisedSignalArray);
  } catch (error) {
    console.error('Error during noise reduction:', error);
    return signalData;
  }
}

/**
 * Process signal data using TensorFlow.js
 * @param signalData - The signal data to process
 * @param noiseOptions - Options for noise reduction
 * @returns The processed signal data
 */
export async function processSignalData(
  signalData: number[],
  noiseOptions: NoiseOptions
): Promise<number[]> {
  try {
    // Apply noise reduction
    const denoisedSignal = await trackPerformanceAsync('TensorFlow', async () => {
      return applyNoiseReduction(signalData, noiseOptions);
    });

    return denoisedSignal;
  } catch (error) {
    console.error('Error processing signal data:', error);
    return signalData;
  }
}

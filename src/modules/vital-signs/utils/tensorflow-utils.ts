
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import * as tf from '@tensorflow/tfjs';

/**
 * Utility functions for TensorFlow operations
 * Used for direct signal processing without simulation
 */

/**
 * Apply normalization to tensor data
 */
export function normalizeSignal(signal: number[]): tf.Tensor1D {
  return tf.tidy(() => {
    const tensor = tf.tensor1d(signal);
    const mean = tf.mean(tensor);
    const std = tf.moments(tensor).variance.sqrt();
    // Add small epsilon to prevent division by zero
    return tensor.sub(mean).div(std.add(tf.scalar(1e-5)));
  });
}

/**
 * Apply windowing function to signal
 */
export function applyWindow(signal: number[], windowType: 'hamming' | 'hann' = 'hamming'): number[] {
  const len = signal.length;
  const windowed = new Array(len);
  
  for (let i = 0; i < len; i++) {
    let windowCoef;
    if (windowType === 'hamming') {
      // Hamming window
      windowCoef = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (len - 1));
    } else {
      // Hann window
      windowCoef = 0.5 * (1 - Math.cos(2 * Math.PI * i / (len - 1)));
    }
    windowed[i] = signal[i] * windowCoef;
  }
  
  return windowed;
}

/**
 * Compute FFT magnitude spectrum using TensorFlow.js
 */
export function computeFFT(signal: number[]): { frequencies: number[], magnitudes: number[] } {
  return tf.tidy(() => {
    // Apply window function to reduce spectral leakage
    const windowedSignal = applyWindow(signal, 'hamming');
    
    // Convert to complex tensor
    const real = tf.tensor1d(windowedSignal);
    const imag = tf.zeros([windowedSignal.length]);
    const complexInput = tf.complex(real, imag);
    
    // Compute FFT
    const fft = tf.spectral.rfft(complexInput);
    
    // Compute magnitude
    const magnitude = tf.abs(fft);
    
    // Get magnitudes as array
    const magnitudes = magnitude.arraySync() as number[];
    
    // Compute frequency bins (Hz) assuming 30Hz sample rate
    const sampleRate = 30; // 30 Hz typical for PPG
    const frequencies = Array.from(
      {length: magnitudes.length}, 
      (_, i) => i * sampleRate / (2 * magnitudes.length)
    );
    
    return {
      frequencies,
      magnitudes
    };
  });
}

/**
 * Calculate dominant frequency from spectrum
 */
export function getDominantFrequency(frequencies: number[], magnitudes: number[], minFreq = 0.5, maxFreq = 4.0): number {
  // Find the frequency with the highest magnitude in the frequency range of interest
  let maxMag = 0;
  let dominantFreq = 0;
  
  for (let i = 0; i < frequencies.length; i++) {
    const freq = frequencies[i];
    if (freq >= minFreq && freq <= maxFreq && magnitudes[i] > maxMag) {
      maxMag = magnitudes[i];
      dominantFreq = freq;
    }
  }
  
  return dominantFreq;
}

/**
 * Apply bandpass filter to focus on physiological frequency range
 * Uses TensorFlow.js for filtering
 */
export function applyBandpassFilter(signal: tf.Tensor, lowCutoff = 0.5, highCutoff = 4.0, sampleRate = 30): tf.Tensor {
  return tf.tidy(() => {
    // Convert to 2D tensor to satisfy type requirements
    const signal2D = signal.reshape([-1, 1]) as tf.Tensor2D;
    
    // Apply bandpass filter
    // Implementation using spectral domain filtering
    const fft = tf.spectral.rfft(signal2D);
    
    // Create frequency mask
    const freqBins = fft.shape[0];
    const freqResolution = sampleRate / (2 * freqBins);
    
    // Create mask tensor
    const maskValues = Array(freqBins).fill(0).map((_, i) => {
      const freq = i * freqResolution;
      return (freq >= lowCutoff && freq <= highCutoff) ? 1.0 : 0.0;
    });
    
    const mask = tf.tensor1d(maskValues).reshape([-1, 1]);
    
    // Apply mask
    const filteredSpectrum = fft.mul(mask);
    
    // Inverse FFT
    const filtered = tf.spectral.irfft(filteredSpectrum);
    
    return filtered;
  });
}

/**
 * Get spectral entropy to measure signal complexity
 */
export function getSpectralEntropy(magnitudes: number[]): number {
  const sum = magnitudes.reduce((a, b) => a + b, 0);
  if (sum === 0) return 0;
  
  // Normalize magnitudes to get probability distribution
  const probabilities = magnitudes.map(m => m / sum);
  
  // Calculate entropy
  let entropy = 0;
  for (const p of probabilities) {
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }
  
  // Normalize by log2(N)
  return entropy / Math.log2(magnitudes.length);
}

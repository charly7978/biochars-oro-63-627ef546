
/**
 * Enhanced signal processor using TensorFlow.js
 * Provides improved signal processing for vital signs measurement
 */
import * as tf from '@tensorflow/tfjs';
import { tensorflowService } from '../tensorflow/TensorflowService';

export interface EnhancedSignalResult {
  processedSignal: number[];
  peaks: number[];
  valleys: number[];
  quality: number;
  confidence: number;
  characteristics: {
    amplitude: number;
    frequency: number;
    snr: number;
    variability: number;
    perfusionIndex: number;
  };
}

export class EnhancedSignalProcessor {
  private initialized: boolean = false;
  
  constructor() {
    this.initialize();
  }
  
  /**
   * Initialize the processor
   */
  private async initialize(): Promise<void> {
    try {
      await tensorflowService.initialize();
      this.initialized = true;
    } catch (error) {
      console.error('EnhancedSignalProcessor: Initialization failed', error);
    }
  }
  
  /**
   * Process signal with advanced processing techniques
   */
  public processSignal(signal: number[]): EnhancedSignalResult {
    if (!this.initialized) {
      // Fallback to basic processing if TensorFlow isn't ready
      return this.fallbackProcessing(signal);
    }
    
    return tf.tidy(() => {
      // Create tensor from signal data
      const signalTensor = tf.tensor1d(signal);
      
      // Apply bandpass filter (0.5Hz - 8Hz) for physiological range
      const filteredSignal = this.applyBandpassFilter(signalTensor);
      
      // Find peaks and valleys using TensorFlow
      const { peakIndices, valleyIndices } = this.findPeaksAndValleys(filteredSignal);
      
      // Calculate signal characteristics
      const characteristics = this.calculateCharacteristics(
        filteredSignal, 
        peakIndices, 
        valleyIndices
      );
      
      // Calculate signal quality based on characteristics
      const quality = this.calculateSignalQuality(characteristics);
      
      // Calculate confidence based on quality and stability
      const confidence = this.calculateConfidence(quality, characteristics);
      
      // Convert back to array for API compatibility
      const processedData = filteredSignal.arraySync() as number[];
      
      return {
        processedSignal: processedData,
        peaks: peakIndices,
        valleys: valleyIndices,
        quality,
        confidence,
        characteristics
      };
    });
  }
  
  /**
   * Apply a bandpass filter to the signal using TensorFlow
   */
  private applyBandpassFilter(signal: tf.Tensor1D): tf.Tensor1D {
    // Create filter coefficients for bandpass (0.5Hz - 8Hz)
    // This range covers normal physiological heart rates (30-240 BPM)
    return tf.tidy(() => {
      // First apply lowpass filter (8Hz cutoff)
      const lowpassed = this.applySmoothing(signal, 5);
      
      // Then apply highpass filter (0.5Hz cutoff) by removing moving average
      const trend = this.applySmoothing(signal, 30);
      const highpassed = lowpassed.sub(trend);
      
      return highpassed;
    });
  }
  
  /**
   * Apply smoothing filter
   */
  private applySmoothing(tensor: tf.Tensor1D, windowSize: number): tf.Tensor1D {
    const weights = tf.ones([windowSize]).div(tf.scalar(windowSize));
    const paddedTensor = tf.pad(tensor, [[Math.floor(windowSize/2), Math.floor(windowSize/2)]]);
    return tf.conv1d(
      paddedTensor.expandDims(1), 
      weights.expandDims(1).expandDims(1), 
      1, 'valid'
    ).squeeze();
  }
  
  /**
   * Find peaks and valleys in signal using TensorFlow
   */
  private findPeaksAndValleys(signal: tf.Tensor1D): {
    peakIndices: number[],
    valleyIndices: number[]
  } {
    // Get signal as array
    const signalArray = signal.arraySync() as number[];
    
    // Find peaks - we cannot fully replace this with TF ops yet
    const peakIndices: number[] = [];
    const valleyIndices: number[] = [];
    
    // Use TF for derivative calculation
    const diff = tf.tidy(() => {
      return signal.slice(1).sub(signal.slice(0, -1)).arraySync() as number[];
    });
    
    // Find zero-crossings in the derivative (peaks and valleys)
    for (let i = 1; i < diff.length; i++) {
      // Peak: derivative changes from positive to negative
      if (diff[i-1] > 0 && diff[i] <= 0) {
        peakIndices.push(i);
      }
      // Valley: derivative changes from negative to positive
      else if (diff[i-1] < 0 && diff[i] >= 0) {
        valleyIndices.push(i);
      }
    }
    
    return { peakIndices, valleyIndices };
  }
  
  /**
   * Calculate signal characteristics using TensorFlow
   */
  private calculateCharacteristics(
    signal: tf.Tensor1D,
    peakIndices: number[],
    valleyIndices: number[]
  ): EnhancedSignalResult["characteristics"] {
    // Get signal as array for some calculations
    const signalArray = signal.arraySync() as number[];
    
    // Calculate amplitude (peak-to-valley)
    let amplitude = 0;
    if (peakIndices.length > 0 && valleyIndices.length > 0) {
      const peakValues = peakIndices.map(i => signalArray[i]);
      const valleyValues = valleyIndices.map(i => signalArray[i]);
      
      amplitude = Math.max(...peakValues) - Math.min(...valleyValues);
    }
    
    // Calculate frequency from peak intervals
    let frequency = 0;
    if (peakIndices.length >= 2) {
      const intervals = [];
      for (let i = 1; i < peakIndices.length; i++) {
        intervals.push(peakIndices[i] - peakIndices[i-1]);
      }
      
      const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
      frequency = 1 / avgInterval;
    }
    
    // Calculate signal-to-noise ratio using TensorFlow
    const snr = tf.tidy(() => {
      const variance = tf.moments(signal).variance;
      const noiseVariance = this.estimateNoiseVariance(signal);
      
      // SNR = signal variance / noise variance
      return variance.div(noiseVariance).dataSync()[0];
    });
    
    // Calculate beat-to-beat variability
    let variability = 0;
    if (peakIndices.length >= 3) {
      const intervals = [];
      for (let i = 1; i < peakIndices.length; i++) {
        intervals.push(peakIndices[i] - peakIndices[i-1]);
      }
      
      // Normalized standard deviation of intervals
      const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
      const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
      variability = Math.sqrt(variance) / mean;
    }
    
    // Calculate perfusion index
    let perfusionIndex = 0;
    if (amplitude > 0) {
      const mean = tf.mean(signal).dataSync()[0];
      perfusionIndex = amplitude / Math.abs(mean);
    }
    
    return {
      amplitude,
      frequency,
      snr,
      variability,
      perfusionIndex
    };
  }
  
  /**
   * Estimate noise variance using high-frequency components
   */
  private estimateNoiseVariance(signal: tf.Tensor1D): tf.Tensor {
    return tf.tidy(() => {
      // Apply high-pass filter to extract noise
      const trend = this.applySmoothing(signal, 3);
      const noise = signal.sub(trend);
      
      // Calculate variance of noise
      return tf.moments(noise).variance;
    });
  }
  
  /**
   * Calculate signal quality based on characteristics
   */
  private calculateSignalQuality(characteristics: EnhancedSignalResult["characteristics"]): number {
    // Calculate quality factors
    const amplitudeFactor = Math.min(1, characteristics.amplitude / 0.5);
    const snrFactor = Math.min(1, characteristics.snr / 10);
    const frequencyFactor = characteristics.frequency > 0.5 && characteristics.frequency < 4 ? 1 : 0.5;
    const variabilityFactor = Math.min(1, Math.max(0, 1 - characteristics.variability));
    
    // Weight the factors
    const quality = (
      amplitudeFactor * 0.3 +
      snrFactor * 0.3 +
      frequencyFactor * 0.2 +
      variabilityFactor * 0.2
    ) * 100;
    
    return Math.min(100, Math.max(0, quality));
  }
  
  /**
   * Calculate confidence based on quality and stability
   */
  private calculateConfidence(quality: number, characteristics: EnhancedSignalResult["characteristics"]): number {
    // Base confidence on quality
    let confidence = quality / 100;
    
    // Adjust based on physiological plausibility
    if (characteristics.frequency < 0.5 || characteristics.frequency > 4) {
      confidence *= 0.7; // Non-physiological frequency reduces confidence
    }
    
    if (characteristics.variability > 0.5) {
      confidence *= 0.8; // High variability reduces confidence
    }
    
    if (characteristics.perfusionIndex < 0.05) {
      confidence *= 0.7; // Low perfusion index reduces confidence
    }
    
    return Math.min(1, Math.max(0, confidence));
  }
  
  /**
   * Fallback to basic processing when TensorFlow isn't available
   */
  private fallbackProcessing(signal: number[]): EnhancedSignalResult {
    console.log('EnhancedSignalProcessor: Using fallback processing');
    
    // Simple peak detection
    const peaks: number[] = [];
    const valleys: number[] = [];
    
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) {
        peaks.push(i);
      } else if (signal[i] < signal[i - 1] && signal[i] < signal[i + 1]) {
        valleys.push(i);
      }
    }
    
    // Simple moving average
    const smoothed = [];
    const windowSize = 5;
    
    for (let i = 0; i < signal.length; i++) {
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, i - windowSize); j <= Math.min(signal.length - 1, i + windowSize); j++) {
        sum += signal[j];
        count++;
      }
      
      smoothed.push(sum / count);
    }
    
    return {
      processedSignal: smoothed,
      peaks,
      valleys,
      quality: 50, // Default mid-range quality
      confidence: 0.5, // Default mid-range confidence
      characteristics: {
        amplitude: Math.max(...signal) - Math.min(...signal),
        frequency: peaks.length / signal.length,
        snr: 1.0,
        variability: 0.1,
        perfusionIndex: 0.1
      }
    };
  }
  
  /**
   * Dispose resources
   */
  public dispose(): void {
    if (tf.engine) {
      tf.engine().endScope();
      tf.engine().disposeVariables();
    }
  }
}

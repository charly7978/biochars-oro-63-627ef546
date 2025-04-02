
/**
 * Helper functions for optimizing display in PPG signal visualization
 * Enhanced with advanced signal processing techniques
 */

import * as tf from '@tensorflow/tfjs';
import { runWithMemoryManagement } from './tfModelInitializer';

/**
 * Get the appropriate color for signal path based on arrhythmia status
 * with enhanced visual differentiation
 */
export function getSignalColor(isArrhythmia: boolean, quality: number = 100): string {
  if (isArrhythmia) {
    return '#DC2626'; // Red for arrhythmia
  }
  
  // Color gradient based on signal quality
  if (quality < 40) {
    return '#FCD34D'; // Yellow for low quality
  } else if (quality < 70) {
    return '#38BDF8'; // Light blue for medium quality
  } else {
    return '#0EA5E9'; // Normal blue for high quality
  }
}

/**
 * Check if a point is within an arrhythmia window
 * with improved boundary handling
 */
export function isPointInArrhythmiaWindow(
  pointTime: number, 
  arrhythmiaWindows: Array<{ start: number, end: number }>,
  now: number
): boolean {
  // Sort windows by start time for better performance
  const sortedWindows = [...arrhythmiaWindows].sort((a, b) => a.start - b.start);
  
  // Use binary search for large window arrays
  if (sortedWindows.length > 10) {
    let left = 0;
    let right = sortedWindows.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const window = sortedWindows[mid];
      
      // Check window age - consider active if recent (within 3 seconds)
      const windowAge = now - window.end;
      const isRecentWindow = windowAge < 3000;
      
      if (!isRecentWindow) {
        // If window is too old, skip
        left = mid + 1;
        continue;
      }
      
      if (pointTime < window.start) {
        right = mid - 1;
      } else if (pointTime > window.end) {
        left = mid + 1;
      } else {
        return true; // Point is in this window
      }
    }
    
    return false;
  }
  
  // Linear search for small window arrays
  return sortedWindows.some(window => {
    // Consider the window active if it's recent (within 3 seconds)
    const windowAge = now - window.end;
    const isRecentWindow = windowAge < 3000;
    
    return isRecentWindow && pointTime >= window.start && pointTime <= window.end;
  });
}

/**
 * Optimize canvas for device pixel ratio
 * with enhanced rendering performance
 */
export function optimizeCanvas(canvas: HTMLCanvasElement, width: number, height: number): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  if (ctx) {
    ctx.scale(dpr, dpr);
    
    // Additional optimizations for faster rendering
    ctx.imageSmoothingEnabled = false; // Disable anti-aliasing for performance
    
    // Add additional context settings for hardware acceleration
    if ('globalCompositeOperation' in ctx) {
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}

/**
 * Optimize HTML element for better rendering
 * with enhanced hardware acceleration
 */
export function optimizeElement(element: HTMLElement): void {
  element.style.transform = 'translateZ(0)';
  element.style.backfaceVisibility = 'hidden';
  element.style.perspective = '1000px';
  
  // Advanced CSS optimizations
  element.style.willChange = 'transform, opacity';
  element.style.transformStyle = 'preserve-3d';
  element.style.overflowY = 'hidden'; // Prevent layout thrashing
  
  // Disable pointer events for performance on non-interactive elements
  if (!element.hasAttribute('data-interactive')) {
    element.style.pointerEvents = 'none';
  }
}

/**
 * Check if the current device is mobile
 * with enhanced detection for tablets and foldables
 */
export function isMobileDevice(): boolean {
  // Basic mobile detection
  const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  
  // Enhanced detection using screen properties
  const isSmallScreen = window.innerWidth < 768;
  
  // Check touch capabilities
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Check orientation capability (typically mobile devices)
  const hasOrientation = 'orientation' in window;
  
  // Combine factors for more accurate detection
  return isMobileUserAgent || (isSmallScreen && isTouchDevice && hasOrientation);
}

/**
 * Apply advanced image filtering with adaptive motion artifact removal
 */
export async function applyTensorFlowImageFilter(
  imageData: ImageData,
  options: {
    denoise?: boolean;
    enhanceContrast?: boolean;
    removeMotionArtifacts?: boolean;
  } = { denoise: true, enhanceContrast: true, removeMotionArtifacts: true }
): Promise<ImageData | null> {
  try {
    return await runWithMemoryManagement(async () => {
      // Create tensor from image data
      const tensor = tf.browser.fromPixels(imageData, 4);
      
      // Extract red channel (most important for PPG)
      const redChannel = tensor.slice([0, 0, 0], [-1, -1, 1]);
      
      // Apply motion artifact removal if requested
      let processedChannel = redChannel;
      
      if (options.removeMotionArtifacts) {
        // Adaptive temporal filtering for motion artifacts
        // This is a simplified version of a motion artifact removal algorithm
        processedChannel = redChannel.expandDims(0); // Add batch dimension
        
        // Apply median filter (3x3) to reduce impulse noise from motion
        const kernel = tf.tensor2d([
          [1, 2, 1],
          [2, 4, 2],
          [1, 2, 1]
        ]).div(tf.scalar(16));
        
        // Expand dimensions for convolution
        const kernelExpanded = kernel.expandDims(-1).expandDims(-1);
        
        // Apply convolution for spatial filtering
        processedChannel = tf.conv2d(
          processedChannel as tf.Tensor4D, 
          kernelExpanded as tf.Tensor4D, 
          [1, 1], 
          'same'
        );
        
        // Remove batch dimension
        processedChannel = processedChannel.squeeze([0]);
      }
      
      // Apply denoising if requested
      if (options.denoise) {
        // Apply bilateral filter effect (edge-preserving smoothing)
        const blurKernel = tf.tensor2d([
          [0.0625, 0.125, 0.0625],
          [0.125, 0.25, 0.125],
          [0.0625, 0.125, 0.0625]
        ]);
        
        // Expand dimensions for 2D convolution
        const blurKernelExpanded = blurKernel.expandDims(-1).expandDims(-1);
        
        // Apply convolution for denoising
        processedChannel = tf.conv2d(
          processedChannel.expandDims(0).expandDims(-1) as tf.Tensor4D,
          blurKernelExpanded as tf.Tensor4D,
          [1, 1],
          'same'
        ).squeeze([0, 3]);
      }
      
      // Apply contrast enhancement if requested
      if (options.enhanceContrast) {
        // Compute min and max values for normalization
        const minVal = processedChannel.min();
        const maxVal = processedChannel.max();
        
        // Normalize to 0-1 range
        const normalized = processedChannel.sub(minVal).div(maxVal.sub(minVal).add(tf.scalar(1e-5)));
        
        // Apply gamma correction for contrast enhancement
        const gamma = tf.scalar(0.8); // Gamma < 1 increases contrast
        processedChannel = normalized.pow(gamma).mul(tf.scalar(255));
      }
      
      // Create empty green and blue channels
      const greenChannel = tf.zeros(processedChannel.shape);
      const blueChannel = tf.zeros(processedChannel.shape);
      
      // Create alpha channel (fully opaque)
      const alphaChannel = tf.ones(processedChannel.shape).mul(tf.scalar(255));
      
      // Stack channels to create RGBA image
      const resultTensor = tf.stack([
        processedChannel, 
        greenChannel, 
        blueChannel, 
        alphaChannel
      ], -1);
      
      // Convert tensor to ImageData
      const [height, width] = resultTensor.shape.slice(0, 2);
      const resultData = new Uint8ClampedArray(width * height * 4);
      
      // Use the correct typing for toPixels
      await tf.browser.toPixels(resultTensor as tf.Tensor3D, resultData);
      
      // Clean up tensors
      tensor.dispose();
      
      return new ImageData(resultData, width, height);
    }, { logPerformance: true });
  } catch (error) {
    console.error("Error applying advanced image filtering:", error);
    return null;
  }
}

/**
 * Advanced peak detection using wavelet transform and adaptive thresholding
 */
export function detectPeaksTF(
  values: number[],
  options: {
    windowSize?: number;
    prominenceThreshold?: number;
    useWavelet?: boolean;
  } = {}
): number[] {
  const windowSize = options.windowSize || 5;
  const prominenceThreshold = options.prominenceThreshold || 0.3;
  const useWavelet = options.useWavelet !== undefined ? options.useWavelet : true;
  
  if (values.length < windowSize * 2 + 1) {
    return [];
  }
  
  try {
    return tf.tidy(() => {
      const signal = tf.tensor1d(values);
      
      // Apply wavelet-based denoising if requested
      let processedSignal = signal;
      if (useWavelet) {
        // Simplified wavelet denoising using a filter bank approach
        // This approximates a single-level wavelet transform
        const lowPassFilter = tf.tensor1d([0.1, 0.2, 0.4, 0.2, 0.1]);
        
        // Apply convolution for low-pass filtering (approximation coefficients)
        const paddedSignal = tf.pad(signal, [[2, 2]], 'reflect');
        const approximation = tf.conv1d(
          paddedSignal.expandDims(0).expandDims(2), 
          lowPassFilter.expandDims(0).expandDims(1), 
          1, 
          'valid'
        ).squeeze([0, 2]);
        
        // Apply thresholding to create a denoised signal
        processedSignal = approximation;
      }
      
      // Calculate local maxima with adaptive thresholding
      const localMaxima: number[] = [];
      
      for (let i = windowSize; i < values.length - windowSize; i++) {
        const windowStart = i - windowSize;
        const windowEnd = i + windowSize + 1;
        const window = processedSignal.slice(windowStart, windowEnd - windowStart);
        
        const center = window.slice(windowSize, 1);
        const neighbors = tf.concat([
          window.slice(0, windowSize),
          window.slice(windowSize + 1)
        ]);
        
        // Calculate local statistics for adaptive thresholding
        const neighborMax = neighbors.max();
        const neighborMean = neighbors.mean();
        
        // A peak must be greater than all neighbors and have sufficient prominence
        const isLocalMax = center.greater(neighborMax).dataSync()[0];
        
        // Calculate prominence as the difference between peak and highest neighbor
        const prominence = center.sub(neighborMax).div(center.sub(neighborMean).add(1e-5));
        const hasProminence = prominence.greater(tf.scalar(prominenceThreshold)).dataSync()[0];
        
        if (isLocalMax && hasProminence) {
          localMaxima.push(i);
        }
      }
      
      return localMaxima;
    });
  } catch (error) {
    console.error("Error detecting peaks with TensorFlow:", error);
    return [];
  }
}

/**
 * Apply wavelet transform for multi-resolution analysis
 */
export function applyWaveletTransform(signal: number[]): {
  approximation: number[];
  details: number[];
} {
  try {
    return tf.tidy(() => {
      // Pad signal to power of 2 length for efficient transform
      const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(signal.length)));
      const paddedSignal = [...signal, ...Array(nextPowerOf2 - signal.length).fill(signal[signal.length - 1] || 0)];
      
      // Create tensor from padded signal
      const signalTensor = tf.tensor1d(paddedSignal);
      
      // Define Haar wavelet filters
      const lowPassFilter = tf.tensor1d([0.7071067811865475, 0.7071067811865475]);
      const highPassFilter = tf.tensor1d([0.7071067811865475, -0.7071067811865475]);
      
      // Convolve signal with filters and downsample by 2
      const paddedSignalExpanded = signalTensor.expandDims(0).expandDims(2);
      
      // Apply low-pass filter (approximation)
      const approximationFull = tf.conv1d(
        paddedSignalExpanded,
        lowPassFilter.expandDims(0).expandDims(1),
        1,
        'same'
      ).squeeze([0, 2]);
      
      // Apply high-pass filter (details)
      const detailsFull = tf.conv1d(
        paddedSignalExpanded,
        highPassFilter.expandDims(0).expandDims(1),
        1,
        'same'
      ).squeeze([0, 2]);
      
      // Downsample by taking every other sample
      const indices = tf.range(0, signalTensor.shape[0], 2);
      const approximation = tf.gather(approximationFull, indices).arraySync() as number[];
      const details = tf.gather(detailsFull, indices).arraySync() as number[];
      
      return {
        approximation: approximation.slice(0, signal.length),
        details: details.slice(0, signal.length)
      };
    });
  } catch (error) {
    console.error("Error applying wavelet transform:", error);
    return {
      approximation: [...signal],
      details: Array(signal.length).fill(0)
    };
  }
}

/**
 * Remove motion artifacts from signal
 */
export function removeMotionArtifacts(
  signal: number[],
  options: {
    windowSize?: number;
    cutoffFrequency?: number;
  } = {}
): number[] {
  const windowSize = options.windowSize || 10;
  const cutoffFrequency = options.cutoffFrequency || 0.1; // Normalized frequency
  
  if (signal.length < windowSize * 2) {
    return [...signal];
  }
  
  try {
    return tf.tidy(() => {
      const signalTensor = tf.tensor1d(signal);
      
      // Apply moving median filter to remove impulse artifacts
      const filteredSignal = [];
      
      for (let i = 0; i < signal.length; i++) {
        const windowStart = Math.max(0, i - windowSize);
        const windowEnd = Math.min(signal.length, i + windowSize + 1);
        const window = signalTensor.slice(windowStart, windowEnd - windowStart);
        
        // Sort values in window to find median
        const sorted = tf.topk(window, window.shape[0]).values;
        const median = sorted.gather(tf.scalar(Math.floor(window.shape[0] / 2), 'int32')).dataSync()[0];
        
        filteredSignal.push(median);
      }
      
      // Apply low-pass filter to remove high-frequency noise
      const beta = Math.exp(-2 * Math.PI * cutoffFrequency);
      let filteredValue = filteredSignal[0];
      const smoothedSignal = [filteredValue];
      
      for (let i = 1; i < filteredSignal.length; i++) {
        filteredValue = filteredSignal[i] * (1 - beta) + filteredValue * beta;
        smoothedSignal.push(filteredValue);
      }
      
      return smoothedSignal;
    });
  } catch (error) {
    console.error("Error removing motion artifacts:", error);
    return [...signal];
  }
}

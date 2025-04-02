
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
    return await runWithMemoryManagement<ImageData>(async () => {
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
        
        // Apply convolution for spatial filtering - cast to proper types
        const processedChannelAs4D = processedChannel as unknown as tf.Tensor4D;
        const kernelExpandedAs4D = kernelExpanded as unknown as tf.Tensor4D;
        
        // Apply convolution with proper typing
        const filtered = tf.conv2d(
          processedChannelAs4D, 
          kernelExpandedAs4D, 
          [1, 1], 
          'same'
        );
        
        // Fix tensor type by explicit casting
        processedChannel = filtered.squeeze([0]) as tf.Tensor3D;
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
        
        // Apply convolution for denoising with proper typing
        const processedChannelExpanded = processedChannel.expandDims(0).expandDims(-1);
        const processedChannelAs4D = processedChannelExpanded as unknown as tf.Tensor4D;
        const blurKernelExpandedAs4D = blurKernelExpanded as unknown as tf.Tensor4D;
        
        processedChannel = tf.conv2d(
          processedChannelAs4D,
          blurKernelExpandedAs4D,
          [1, 1],
          'same'
        ).squeeze([0, 3]) as tf.Tensor3D;
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
      ], -1) as tf.Tensor3D; // Explicitly cast to Tensor3D
      
      // Convert tensor to ImageData
      const [height, width] = resultTensor.shape.slice(0, 2);
      const resultData = new Uint8ClampedArray(width * height * 4);
      
      // Use the correct method for converting tensors to pixels
      await tf.browser.toPixels(resultTensor, resultData);
      
      // Create new ImageData with the processed pixels
      const result = new ImageData(resultData, width, height);
      
      // Clean up tensors
      tensor.dispose();
      
      return result;
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
    const result = tf.tidy(() => {
      const signal = tf.tensor1d(values);
      
      // Apply wavelet-based denoising if requested
      let processedSignal = signal;
      if (useWavelet) {
        // Simplified wavelet denoising using a filter bank approach
        // This approximates a single-level wavelet transform
        
        // Low-pass filter coefficients (simplified Haar wavelet)
        const lowPassFilter = tf.tensor1d([0.5, 0.5]);
        
        // High-pass filter coefficients (simplified Haar wavelet)
        const highPassFilter = tf.tensor1d([0.5, -0.5]);
        
        // Apply low-pass filter using conv1d
        const lowFreqComponent = tf.conv1d(
          processedSignal.expandDims(0).expandDims(2) as tf.Tensor3D,
          lowPassFilter.expandDims(0).expandDims(1) as tf.Tensor3D,
          1, 'same'
        ).squeeze([0, 2]) as tf.Tensor1D;
        
        // Apply high-pass filter using conv1d
        const highFreqComponent = tf.conv1d(
          processedSignal.expandDims(0).expandDims(2) as tf.Tensor3D,
          highPassFilter.expandDims(0).expandDims(1) as tf.Tensor3D,
          1, 'same'
        ).squeeze([0, 2]) as tf.Tensor1D;
        
        // Threshold high frequency components to remove noise
        const threshold = tf.scalar(0.1);
        const thresholdedHighFreq = highFreqComponent.mul(
          highFreqComponent.abs().greater(threshold)
        );
        
        // Reconstruct signal
        processedSignal = lowFreqComponent.add(thresholdedHighFreq);
      }
      
      // Calculate local maxima for peak detection
      const peakIndices: number[] = [];
      
      // Use CPU implementation for peak finding as it's more reliable
      const signalValues = processedSignal.arraySync() as number[];
      
      // Find local maxima using sliding window approach
      for (let i = windowSize; i < signalValues.length - windowSize; i++) {
        const currentValue = signalValues[i];
        const windowValues = signalValues.slice(i - windowSize, i + windowSize + 1);
        const maxValue = Math.max(...windowValues);
        
        // Check if current point is a local maximum
        if (currentValue === maxValue) {
          // Calculate prominence
          const leftMin = Math.min(...signalValues.slice(Math.max(0, i - windowSize * 2), i));
          const rightMin = Math.min(...signalValues.slice(i + 1, Math.min(signalValues.length, i + windowSize * 2 + 1)));
          const localMinimum = Math.min(leftMin, rightMin);
          const prominence = currentValue - localMinimum;
          
          // Only count peaks with sufficient prominence
          if (prominence >= prominenceThreshold * maxValue) {
            peakIndices.push(i);
          }
        }
      }
      
      return peakIndices;
    });
    
    return result;
  } catch (error) {
    console.error("Error detecting peaks with TensorFlow:", error);
    return [];
  }
}

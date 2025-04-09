
/**
 * Helper functions for optimizing display in PPG signal visualization
 * Enhanced with error-resistant algorithms and TensorFlow optimization
 */

import * as tf from '@tensorflow/tfjs';
import { runWithMemoryManagement } from './tfModelInitializer';
import { normalizeSignalValue, adaptiveFilter } from './signalNormalization';

/**
 * Get the appropriate color for signal path based on arrhythmia status
 */
export function getSignalColor(isArrhythmia: boolean): string {
  return isArrhythmia ? '#DC2626' : '#0EA5E9';
}

/**
 * Check if a point is within an arrhythmia window with bounds checking
 */
export function isPointInArrhythmiaWindow(
  pointTime: number, 
  arrhythmiaWindows: Array<{ start: number, end: number }>,
  now: number
): boolean {
  if (!arrhythmiaWindows || !Array.isArray(arrhythmiaWindows)) {
    return false; // Safety check
  }
  
  return arrhythmiaWindows.some(window => {
    if (!window || typeof window.start !== 'number' || typeof window.end !== 'number') {
      return false; // Skip invalid windows
    }
    
    // Consider the window active if it's recent (within 3 seconds)
    const windowAge = now - window.end;
    const isRecentWindow = windowAge < 3000;
    
    return isRecentWindow && pointTime >= window.start && pointTime <= window.end;
  });
}

/**
 * Optimize canvas for device pixel ratio with error handling
 */
export function optimizeCanvas(canvas: HTMLCanvasElement, width: number, height: number): void {
  try {
    if (!canvas || width <= 0 || height <= 0) {
      console.error('Invalid canvas or dimensions:', { canvas, width, height });
      return;
    }
    
    const dpr = window.devicePixelRatio || 1;
    const scaledWidth = width * dpr;
    const scaledHeight = height * dpr;
    
    // Limit maximum dimensions to prevent crashes
    const maxDimension = 16384; // Maximum texture size most GPUs support
    const limitedWidth = Math.min(scaledWidth, maxDimension);
    const limitedHeight = Math.min(scaledHeight, maxDimension);
    
    canvas.width = limitedWidth;
    canvas.height = limitedHeight;
    
    // Use CSS to maintain visual dimensions
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      
      // Additional optimizations for better rendering
      ctx.imageSmoothingEnabled = false; // Disable antialiasing for sharper lines
    } else {
      console.error('Could not get canvas context');
    }
  } catch (error) {
    console.error('Error optimizing canvas:', error);
  }
}

/**
 * Optimize HTML element for better rendering
 */
export function optimizeElement(element: HTMLElement): void {
  try {
    if (!element) return;
    
    element.style.transform = 'translateZ(0)';
    element.style.backfaceVisibility = 'hidden';
    element.style.perspective = '1000px';
    
    // Additional optimizations
    element.style.willChange = 'transform'; // Hint browser for optimization
  } catch (error) {
    console.error('Error optimizing element:', error);
  }
}

/**
 * Check if the current device is mobile with additional checks
 */
export function isMobileDevice(): boolean {
  try {
    // Primary check: user agent
    const userAgentCheck = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    
    // Secondary check: screen size
    const screenCheck = window.innerWidth <= 768;
    
    // Tertiary check: touch support
    const touchCheck = 'ontouchstart' in window || 
                      navigator.maxTouchPoints > 0 || 
                      (navigator as any).msMaxTouchPoints > 0;
    
    // Combined result
    return userAgentCheck || (screenCheck && touchCheck);
  } catch (error) {
    console.error('Error detecting mobile device:', error);
    return false; // Default to desktop on error
  }
}

/**
 * Apply TensorFlow image filtering to improve signal with enhanced error handling
 */
export async function applyTensorFlowImageFilter(
  imageData: ImageData
): Promise<ImageData | null> {
  if (!imageData || !imageData.data || imageData.width <= 0 || imageData.height <= 0) {
    console.error('Invalid image data for filtering');
    return null;
  }
  
  try {
    // Use the memory management wrapper for TensorFlow operations
    return await runWithMemoryManagement(async () => {
      // Create tensor from image data
      const tensor = tf.browser.fromPixels(imageData, 4);
      
      // Apply operations in tidy to automatically clean up tensors
      const result = tf.tidy('imageFilter', () => {
        // Extract red channel
        const redChannel = tensor.slice([0, 0, 0], [-1, -1, 1]);
        
        // Apply Gaussian blur for noise reduction
        const blurred = redChannel.expandDims(0).expandDims(-1);
        
        // Create properly typed kernel for TensorFlow.js
        // Use a regular number array but properly shape it to 4D dimensions
        const kernelValues = [
          [[[0.0625]], [[0.125]], [[0.0625]]],
          [[[0.125]], [[0.25]], [[0.125]]],
          [[[0.0625]], [[0.125]], [[0.0625]]]
        ];
        
        // Convert to proper tensor format with explicit typing
        const kernel4D = tf.tensor4d(kernelValues);
        
        // Apply convolution with proper typing
        const convolved = tf.conv2d(blurred as tf.Tensor4D, kernel4D, 1, 'same');
        
        // Add edge detection to highlight blood flow features
        const edgeKernel = [
          [[[0]], [[-1]], [[0]]],
          [[[-1]], [[4]], [[-1]]],
          [[[0]], [[-1]], [[0]]]
        ];
        
        const edgeDetector = tf.tensor4d(edgeKernel);
        const edges = tf.conv2d(blurred as tf.Tensor4D, edgeDetector, 1, 'same');
        
        // Combine filtered image with edges
        const combinedFilter = convolved.add(edges.mul(tf.scalar(0.2)));
        
        // Convert back to ImageData
        const filteredRed = combinedFilter.squeeze();
        
        // Create RGB image with filtered red channel using properly typed tensors
        return tf.stack([
          filteredRed,
          tf.zeros(filteredRed.shape),
          tf.zeros(filteredRed.shape),
          tf.ones(filteredRed.shape).mul(255)
        ], -1) as tf.Tensor3D;
      });
      
      // Convert tensor to ImageData - ensure correct typing
      const [height, width] = result.shape.slice(0, 2);
      const filteredData = new Uint8ClampedArray(width * height * 4);
      
      // Fix: Use type assertion to work around the TypeScript error
      // The TensorFlow.js types are not accurate here - toPixels can accept a Uint8ClampedArray
      await tf.browser.toPixels(result, filteredData as unknown as HTMLCanvasElement);
      
      // Clean up tensors
      tensor.dispose();
      result.dispose();
      
      return new ImageData(filteredData, width, height);
    }, 'applyTensorFlowImageFilter');
  } catch (error) {
    console.error("Error applying TensorFlow image filter:", error);
    return null;
  }
}

/**
 * Enhanced peak detection using TensorFlow with fallback mechanisms
 */
export function detectPeaksTF(
  values: number[],
  windowSize: number = 5
): number[] {
  if (!values || !Array.isArray(values) || values.length < windowSize * 2 + 1) {
    return [];
  }
  
  try {
    // First try with TensorFlow
    return tf.tidy('detectPeaks', () => {
      try {
        const signal = tf.tensor1d(values);
        
        // Calculate local maxima
        const localMaxima: number[] = [];
        
        for (let i = windowSize; i < values.length - windowSize; i++) {
          const window = signal.slice(i - windowSize, windowSize * 2 + 1);
          const center = window.slice(windowSize, 1);
          const neighbors = tf.concat([
            window.slice(0, windowSize),
            window.slice(windowSize + 1)
          ]);
          
          // Check if center is greater than all neighbors
          const isLocalMax = center.greater(neighbors.max()).dataSync()[0];
          
          if (isLocalMax) {
            localMaxima.push(i);
          }
        }
        
        return localMaxima;
      } catch (tfError) {
        console.warn("TensorFlow peak detection failed, using fallback:", tfError);
        
        // Fallback to traditional method
        return detectPeaksFallback(values, windowSize);
      }
    });
  } catch (error) {
    console.error("Error detecting peaks:", error);
    
    // Ultimate fallback
    return detectPeaksFallback(values, windowSize);
  }
}

/**
 * Traditional peak detection as a fallback
 */
function detectPeaksFallback(values: number[], windowSize: number = 5): number[] {
  try {
    const peaks: number[] = [];
    
    for (let i = windowSize; i < values.length - windowSize; i++) {
      const currentValue = values[i];
      let isPeak = true;
      
      // Check if current point is greater than all points in window
      for (let j = i - windowSize; j <= i + windowSize; j++) {
        if (j !== i && values[j] >= currentValue) {
          isPeak = false;
          break;
        }
      }
      
      if (isPeak) {
        peaks.push(i);
      }
    }
    
    return peaks;
  } catch (error) {
    console.error("Error in fallback peak detection:", error);
    return [];
  }
}

/**
 * Apply multi-level filtering to a signal
 */
export function applySignalFiltering(values: number[]): number[] {
  if (!values || !Array.isArray(values) || values.length === 0) {
    return [];
  }
  
  try {
    // Make a copy to avoid modifying original array
    let filtered = [...values];
    
    // Apply baseline correction
    filtered = filtered.map((val, i, arr) => {
      if (i === 0) return val;
      
      // Simple baseline trend estimation using local average
      const windowSize = Math.min(20, i);
      const baseline = arr.slice(i - windowSize, i).reduce((sum, v) => sum + v, 0) / windowSize;
      
      // Remove baseline trend
      return val - (baseline * 0.8); // 80% baseline correction
    });
    
    // Apply adaptive filtering
    for (let i = 1; i < filtered.length; i++) {
      filtered[i] = adaptiveFilter(filtered[i], filtered.slice(0, i));
    }
    
    return filtered;
  } catch (error) {
    console.error("Error filtering signal:", error);
    return [...values]; // Return original on error
  }
}

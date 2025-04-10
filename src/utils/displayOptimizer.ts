
/**
 * Helper functions for optimizing display in PPG signal visualization
 */

import * as tf from '@tensorflow/tfjs';

/**
 * Get the appropriate color for signal path based on arrhythmia status
 */
export function getSignalColor(isArrhythmia: boolean): string {
  return isArrhythmia ? '#DC2626' : '#0EA5E9';
}

/**
 * Check if a point is within an arrhythmia window
 */
export function isPointInArrhythmiaWindow(
  pointTime: number, 
  arrhythmiaWindows: Array<{ start: number, end: number }>,
  now: number
): boolean {
  return arrhythmiaWindows.some(window => {
    // Consider the window active if it's recent (within 3 seconds)
    const windowAge = now - window.end;
    const isRecentWindow = windowAge < 3000;
    
    return isRecentWindow && pointTime >= window.start && pointTime <= window.end;
  });
}

/**
 * Optimize canvas for device pixel ratio
 */
export function optimizeCanvas(canvas: HTMLCanvasElement, width: number, height: number): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(dpr, dpr);
  }
}

/**
 * Optimize HTML element for better rendering
 */
export function optimizeElement(element: HTMLElement): void {
  element.style.transform = 'translateZ(0)';
  element.style.backfaceVisibility = 'hidden';
  element.style.perspective = '1000px';
}

/**
 * Check if the current device is mobile
 */
export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Apply TensorFlow image filtering to improve signal
 */
export async function applyTensorFlowImageFilter(
  imageData: ImageData
): Promise<ImageData | null> {
  try {
    // Create tensor from image data
    const tensor = tf.browser.fromPixels(imageData, 4);
    
    // Apply operations in tidy to automatically clean up tensors
    const result = tf.tidy(() => {
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
      
      // Convert back to ImageData
      const filteredRed = convolved.squeeze();
      
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
  } catch (error) {
    console.error("Error applying TensorFlow image filter:", error);
    return null;
  }
}

/**
 * Enhanced peak detection using TensorFlow
 */
export function detectPeaksTF(
  values: number[],
  windowSize: number = 5
): number[] {
  if (values.length < windowSize * 2 + 1) {
    return [];
  }
  
  try {
    const peaks = tf.tidy(() => {
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
    });
    
    return peaks;
  } catch (error) {
    console.error("Error detecting peaks with TensorFlow:", error);
    return [];
  }
}

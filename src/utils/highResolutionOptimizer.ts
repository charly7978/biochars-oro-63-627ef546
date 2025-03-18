
/**
 * Utility for optimizing display on high-resolution devices
 * Display optimization only - no simulation or data manipulation
 */

import { isMobileDevice, optimizeCanvas, optimizeElement } from './displayOptimizer';

/**
 * Optimize a canvas element for the device's pixel ratio
 * Visual display adjustment only - no simulation or data manipulation
 */
export const optimizeCanvasForDisplay = (canvas: HTMLCanvasElement): void => {
  if (!canvas) return;
  
  // Apply basic optimization
  optimizeCanvas(canvas);
  
  // Additional mobile-specific optimization
  if (isMobileDevice()) {
    // Set explicit dimensions for mobile
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
  }
};

/**
 * Apply device-specific optimizations to an element
 * Visual display adjustment only - no simulation or data manipulation
 */
export const applyDeviceSpecificOptimizations = (element: HTMLElement): void => {
  if (!element) return;
  
  // Apply base optimization
  optimizeElement(element);
  
  // Apply additional optimizations for mobile
  if (isMobileDevice()) {
    element.classList.add('mobile-optimized');
  }
};

/**
 * Get appropriate scaling factor for current device
 * Display calculation only - no simulation or data manipulation
 */
export const getDeviceScalingFactor = (): number => {
  const dpr = window.devicePixelRatio || 1;
  
  // Additional scaling for mobile devices
  if (isMobileDevice()) {
    return Math.min(dpr * 1.2, 3); // Cap at 3x
  }
  
  return dpr;
};

export default {
  optimizeCanvasForDisplay,
  applyDeviceSpecificOptimizations,
  getDeviceScalingFactor
};

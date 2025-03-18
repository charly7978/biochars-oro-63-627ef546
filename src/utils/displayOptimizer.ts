
/**
 * Utilities for optimizing display elements
 */

/**
 * Checks if the current device is a mobile device
 */
export const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Optimizes a canvas element for high resolution displays
 * @param canvas The canvas element to optimize
 * @param width Optional width to set
 * @param height Optional height to set
 */
export const optimizeCanvas = (
  canvas: HTMLCanvasElement, 
  width?: number, 
  height?: number
): void => {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  
  // Set display size
  canvas.width = (width || rect.width) * dpr;
  canvas.height = (height || rect.height) * dpr;
  
  // Scale context
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(dpr, dpr);
  }
  
  // Set CSS size
  canvas.style.width = `${width || rect.width}px`;
  canvas.style.height = `${height || rect.height}px`;
};

/**
 * Optimizes any DOM element for high resolution displays
 * @param element The element to optimize
 */
export const optimizeElement = (element: HTMLElement): void => {
  if (!element) return;
  
  const dpr = window.devicePixelRatio || 1;
  
  if (dpr > 1) {
    element.style.transform = `scale(${1/dpr})`;
    element.style.transformOrigin = 'top left';
    
    // Force pixel-perfect rendering
    if (element.style.fontKerning) {
      element.style.fontKerning = 'normal';
    }
    
    if (element.style.fontSmoothing) {
      (element.style as any).fontSmoothing = 'antialiased';
    }
    
    if ((element.style as any).webkitFontSmoothing) {
      (element.style as any).webkitFontSmoothing = 'antialiased';
    }
  }
};

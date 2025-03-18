
/**
 * Display optimization utilities
 * For high resolution rendering of UI components
 */

/**
 * Check if the current device is a mobile device
 */
export const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Optimize a canvas element for high resolution displays
 */
export const optimizeCanvas = (canvas: HTMLCanvasElement): void => {
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // Set for high DPI displays
  const dpr = window.devicePixelRatio || 1;
  
  // Get the css size
  const rect = canvas.getBoundingClientRect();
  
  // Give the canvas pixel dimensions of their CSS size * the device pixel ratio
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  
  // Scale all drawing operations by the dpr
  ctx.scale(dpr, dpr);
  
  // Set display size
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  
  // Disable anti-aliasing for sharper lines
  ctx.imageSmoothingEnabled = false;
};

/**
 * Optimize any DOM element for high resolution displays
 */
export const optimizeElement = (element: HTMLElement): void => {
  if (!element) return;
  
  // Apply GPU acceleration
  element.style.willChange = 'transform';
  element.style.transform = 'translateZ(0)';
  element.style.backfaceVisibility = 'hidden';
  
  // Improve text rendering
  element.style.textRendering = 'geometricPrecision';
  
  // Add high-resolution class
  if (window.devicePixelRatio > 1) {
    element.classList.add('high-dpi');
  }
};

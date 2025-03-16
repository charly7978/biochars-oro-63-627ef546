
/**
 * Utility functions for optimizing display rendering on various screen densities
 * and providing precise visual feedback for cardiovascular measurements
 */

// Check if the device has a high-DPI display
export const isHighDpiDisplay = (): boolean => {
  return window.devicePixelRatio > 1;
};

// Get the current device pixel ratio
export const getDevicePixelRatio = (): number => {
  return window.devicePixelRatio || 1;
};

// Optimize a canvas for the device's pixel ratio
export const optimizeCanvas = (canvas: HTMLCanvasElement): void => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  const dpr = getDevicePixelRatio();
  const rect = canvas.getBoundingClientRect();
  
  // Set the canvas dimensions accounting for the device pixel ratio
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  
  // Scale the context to ensure correct drawing operations
  ctx.scale(dpr, dpr);
  
  // Disable smoothing for sharper rendering of signal data
  ctx.imageSmoothingEnabled = false;
  
  // Set the CSS width and height to the original dimensions
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
};

// Apply performance optimizations to DOM elements
export const applyPerformanceOptimizations = (element: HTMLElement): void => {
  // Apply hardware acceleration
  element.style.transform = 'translate3d(0, 0, 0)';
  element.style.backfaceVisibility = 'hidden';
  element.style.willChange = 'transform';
  
  // Apply performance classes
  element.classList.add('performance-boost');
  
  // If this is a graph or visualization, apply additional optimizations
  if (
    element.classList.contains('ppg-signal-meter') || 
    element.classList.contains('graph-container') ||
    element.tagName.toLowerCase() === 'canvas'
  ) {
    element.classList.add('ppg-graph');
    element.style.contain = 'strict';
  }
};

// Apply text rendering optimizations
export const optimizeTextRendering = (element: HTMLElement): void => {
  element.style.textRendering = 'geometricPrecision';
  
  if (isHighDpiDisplay()) {
    element.style.textRendering = 'geometricPrecision';
    element.style.webkitFontSmoothing = 'antialiased';
    element.style.fontSmoothing = 'antialiased';
    element.style.mozOsxFontSmoothing = 'grayscale';
  }
  
  // For numeric displays that need to be particularly crisp
  if (
    element.classList.contains('vital-display') || 
    element.classList.contains('precision-number')
  ) {
    element.style.fontFeatureSettings = '"tnum", "zero"';
    element.style.fontVariantNumeric = 'tabular-nums';
    element.style.letterSpacing = '-0.02em';
  }
};

// Apply all optimizations to an element and its children
export const optimizeElement = (element: HTMLElement): void => {
  applyPerformanceOptimizations(element);
  optimizeTextRendering(element);
  
  // Recursively optimize all child elements
  Array.from(element.children).forEach(child => {
    if (child instanceof HTMLElement) {
      optimizeElement(child);
    }
    
    // Special handling for canvases
    if (child instanceof HTMLCanvasElement) {
      optimizeCanvas(child);
    }
  });
};

// Helper to apply all optimizations to a specific selector
export const optimizeSelector = (selector: string): void => {
  const elements = document.querySelectorAll<HTMLElement>(selector);
  elements.forEach(optimizeElement);
};

// Signal color optimization for maximum visual clarity
export const getSignalColor = (isArrhythmia: boolean): string => {
  if (isArrhythmia) {
    // Red optimized for arrhythmia visualization
    return '#ff3b4e';
  } else {
    // Blue optimized for normal rhythm
    return '#1e90ff';
  }
};

// Algorithm to determine if a point is in arrhythmia window
export const isPointInArrhythmiaWindow = (
  pointData: any
): boolean => {
  return pointData?.isArrhythmia === true;
};


/**
 * Utility functions for optimizing display rendering on various screen densities
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
  
  // Apply high-performance rendering settings - only when needed
  if (canvas.classList.contains('ppg-graph')) {
    ctx.imageSmoothingEnabled = false;
  }
  
  // Set the CSS width and height to the original dimensions
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
};

/**
 * Selectively apply performance optimizations to DOM elements
 * Only applies hardware acceleration to elements that really need it
 */
export const applyPerformanceOptimizations = (element: HTMLElement): void => {
  // Only apply hardware acceleration to elements that need it
  if (
    element.classList.contains('ppg-signal-meter') || 
    element.classList.contains('graph-container') ||
    element.classList.contains('ppg-graph') ||
    element.tagName.toLowerCase() === 'canvas'
  ) {
    // Apply hardware acceleration
    element.style.transform = 'translate3d(0, 0, 0)';
    element.style.backfaceVisibility = 'hidden';
    
    // Only apply will-change to elements that will actually animate
    if (element.classList.contains('ppg-signal-meter')) {
      element.style.willChange = 'transform';
    }
    
    // Apply performance classes
    element.classList.add('performance-boost');
    
    // For graphs, apply additional optimizations
    if (
      element.classList.contains('ppg-signal-meter') || 
      element.classList.contains('graph-container') ||
      element.classList.contains('ppg-graph')
    ) {
      element.classList.add('ppg-graph');
      element.style.contain = 'content'; // Changed from 'strict' to 'content' for better balance
    }
  }
};

// Apply text rendering optimizations
export const optimizeTextRendering = (element: HTMLElement): void => {
  // Only apply geometric precision to elements that need it
  if (
    element.classList.contains('vital-display') || 
    element.classList.contains('precision-number') ||
    element.classList.contains('precision-text')
  ) {
    element.style.textRendering = 'geometricPrecision';
  } else {
    // Use optimizeSpeed for other text elements
    element.style.textRendering = 'optimizeSpeed';
  }
  
  if (isHighDpiDisplay()) {
    // Fix for TypeScript error - using setAttribute instead of direct property assignment
    element.setAttribute('style', element.getAttribute('style') + ' -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;');
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

/**
 * Optimized version that applies performance improvements selectively
 * and uses batched operations to avoid excessive reflows
 */
export const optimizeElement = (element: HTMLElement): void => {
  // Early exit for non-visible elements to save processing
  if (!element.offsetParent) return;
  
  // Use requestAnimationFrame to batch DOM operations
  requestAnimationFrame(() => {
    // First collect all elements that need optimization
    const elementsToOptimize = new Set<HTMLElement>();
    const canvases = new Set<HTMLCanvasElement>();
    
    // Add the root element
    elementsToOptimize.add(element);
    
    // Find all child elements that need optimization
    Array.from(element.querySelectorAll('.performance-boost, .ppg-graph, .vital-display, .precision-number, canvas')).forEach(el => {
      if (el instanceof HTMLElement) {
        elementsToOptimize.add(el);
      }
      if (el instanceof HTMLCanvasElement) {
        canvases.add(el);
      }
    });
    
    // Now apply optimizations in batches to avoid excessive reflows
    // First apply performance optimizations
    elementsToOptimize.forEach(el => {
      applyPerformanceOptimizations(el);
    });
    
    // Then apply text rendering optimizations in a separate batch
    elementsToOptimize.forEach(el => {
      optimizeTextRendering(el);
    });
    
    // Finally optimize canvases
    canvases.forEach(canvas => {
      optimizeCanvas(canvas);
    });
  });
};

// Helper to apply all optimizations to a specific selector
export const optimizeSelector = (selector: string): void => {
  const elements = document.querySelectorAll<HTMLElement>(selector);
  elements.forEach(optimizeElement);
};

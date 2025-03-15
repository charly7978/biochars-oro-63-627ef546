
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
  
  // Apply high-performance rendering settings
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
    element.style.webkitFontSmoothing = 'antialiased';
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

// Force the browser into fullscreen immersive mode
export const enterImmersiveMode = async (): Promise<void> => {
  try {
    // Request fullscreen mode
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      await elem.requestFullscreen();
    } else if ((elem as any).webkitRequestFullscreen) {
      await (elem as any).webkitRequestFullscreen();
    } else if ((elem as any).mozRequestFullScreen) {
      await (elem as any).mozRequestFullScreen();
    } else if ((elem as any).msRequestFullscreen) {
      await (elem as any).msRequestFullscreen();
    }
    
    // Try to lock orientation to portrait for mobile devices
    if (screen.orientation?.lock) {
      try {
        await screen.orientation.lock('portrait');
      } catch (err) {
        console.warn('Could not lock screen orientation:', err);
      }
    }
    
    // Apply high density display optimizations
    document.body.classList.add('immersive-mode');
    if (window.devicePixelRatio > 1) {
      document.body.classList.add('high-dpi');
    }
    if (window.devicePixelRatio >= 2) {
      document.body.classList.add('retina');
    }
    if (window.devicePixelRatio >= 3) {
      document.body.classList.add('ultra-hd');
    }
    
    // Set CSS variables for device pixel ratio
    document.documentElement.style.setProperty('--device-pixel-ratio', window.devicePixelRatio.toString());
    
    console.log('Entered immersive fullscreen mode with DPR:', window.devicePixelRatio);
  } catch (err) {
    console.error('Failed to enter immersive fullscreen mode:', err);
  }
};

// Update display settings based on screen resolution
export const optimizeForScreenResolution = (): void => {
  const width = window.screen.width;
  const height = window.screen.height;
  const dpr = window.devicePixelRatio;
  
  // Calculate effective resolution
  const effectiveWidth = width * dpr;
  const effectiveHeight = height * dpr;
  
  console.log(`Screen resolution: ${width}x${height}, DPR: ${dpr}, Effective: ${effectiveWidth}x${effectiveHeight}`);
  
  // Apply appropriate scaling class based on effective resolution
  const rootElement = document.getElementById('root');
  if (!rootElement) return;
  
  rootElement.classList.add('high-res-interface');
  
  // Apply specific optimizations based on resolution tiers
  if (effectiveWidth >= 3840 || effectiveHeight >= 3840) {
    rootElement.classList.add('resolution-4k');
    document.documentElement.classList.add('display-4k');
  } 
  else if (effectiveWidth >= 2560 || effectiveHeight >= 2560) {
    rootElement.classList.add('resolution-2k');
    document.documentElement.classList.add('display-2k');
  }
  else if (effectiveWidth >= 1920 || effectiveHeight >= 1920) {
    rootElement.classList.add('resolution-fhd');
    document.documentElement.classList.add('display-fhd');
  }
  
  // Update meta viewport tag for optimal rendering
  const metaViewport = document.querySelector('meta[name="viewport"]');
  if (metaViewport) {
    metaViewport.setAttribute('content', 
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, target-densitydpi=device-dpi');
  }
};

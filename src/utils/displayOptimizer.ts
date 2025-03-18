
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Get appropriate color for signal visualization
 * Direct visualization only - no simulation or manipulation
 */
export const getSignalColor = (isArrhythmia: boolean): string => {
  return isArrhythmia ? '#FF2E2E' : '#0EA5E9';
};

/**
 * Check if a time point is within an arrhythmia window
 * Direct visualization only - no simulation or manipulation
 */
export const isPointInArrhythmiaWindow = (
  pointTime: number, 
  arrhythmiaWindows: {start: number, end: number}[]
): boolean => {
  return arrhythmiaWindows.some(window => 
    pointTime >= window.start && pointTime <= window.end
  );
};

/**
 * Optimizes canvas for high DPI displays with maximum resolution support
 * No data manipulation, just display optimization
 */
export const optimizeCanvas = (canvas: HTMLCanvasElement, width: number, height: number): void => {
  const dpr = window.devicePixelRatio || 1;
  
  // Scale canvas according to device pixel ratio for maximum resolution
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Adjust scale to match device pixel ratio
    ctx.scale(dpr, dpr);
    
    // Disable image smoothing for crisp rendering
    ctx.imageSmoothingEnabled = false;
    
    // Add high-performance attributes to canvas
    canvas.style.transform = 'translateZ(0)';
    canvas.style.backfaceVisibility = 'hidden';
    canvas.style.willChange = 'transform';
    
    // Apply the best rendering mode based on device capabilities
    if (dpr >= 2) {
      canvas.classList.add('high-dpi-canvas');
    }
    if (dpr >= 3) {
      canvas.classList.add('ultra-high-dpi-canvas');
    }
    if (width * dpr >= 3840 || height * dpr >= 2160) {
      canvas.classList.add('4k-resolution');
    }
  }
};

/**
 * Optimizes DOM element for high performance rendering with maximum resolution
 * No data manipulation, just display optimization
 */
export const optimizeElement = (element: HTMLElement): void => {
  element.style.transform = 'translate3d(0,0,0)';
  element.style.backfaceVisibility = 'hidden';
  element.style.willChange = 'transform';
  
  // Using standard properties only
  element.style.textRendering = 'optimizeSpeed';
  
  // Add maximum resolution classes
  element.classList.add('maximum-resolution');
  
  // Apply specific optimizations based on element type
  if (element instanceof HTMLCanvasElement || 
      element.classList.contains('ppg-graph') || 
      element.tagName === 'CANVAS') {
    element.style.imageRendering = 'pixelated';
    element.style.imageRendering = '-webkit-optimize-contrast';
  } else if (element instanceof HTMLVideoElement) {
    element.style.objectFit = 'cover';
    element.style.imageRendering = '-webkit-optimize-contrast';
  }
  
  // Apply special high-DPI settings
  const dpr = window.devicePixelRatio || 1;
  if (dpr > 1) {
    element.classList.add('high-dpi-element');
    
    if (dpr >= 3) {
      element.classList.add('ultra-high-dpi-element');
    }
  }
};

/**
 * Determines optimum display resolution for the current device
 * For display optimization only
 */
export const getOptimumResolution = (): { width: number, height: number, pixelRatio: number } => {
  const dpr = window.devicePixelRatio || 1;
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  
  // Calculate the true physical resolution
  const trueWidth = Math.round(screenWidth * dpr);
  const trueHeight = Math.round(screenHeight * dpr);
  
  return {
    width: trueWidth,
    height: trueHeight,
    pixelRatio: dpr
  };
};

/**
 * Check if device is mobile
 * For display optimization only
 */
export const isMobileDevice = (): boolean => {
  const userAgent = navigator.userAgent.toLowerCase();
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
};

/**
 * Set maximum resolution mode for the application
 * For display optimization only - applies maximum available resolution
 */
export const setMaximumResolutionMode = (): void => {
  if (typeof document === 'undefined') return;
  
  const { width, height, pixelRatio } = getOptimumResolution();
  
  console.log(`Setting maximum resolution mode: ${width}x${height} (${pixelRatio}x)`);
  
  // Set CSS variables for use in styles
  document.documentElement.style.setProperty('--true-screen-width', `${width}px`);
  document.documentElement.style.setProperty('--true-screen-height', `${height}px`);
  document.documentElement.style.setProperty('--device-pixel-ratio', pixelRatio.toString());
  
  // Add resolution classes to document
  document.documentElement.classList.add('maximum-resolution-mode');
  
  if (pixelRatio >= 2) document.documentElement.classList.add('retina-display');
  if (pixelRatio >= 3) document.documentElement.classList.add('ultra-high-dpi');
  
  if (width >= 7680) document.documentElement.classList.add('resolution-8k');
  else if (width >= 5120) document.documentElement.classList.add('resolution-5k');
  else if (width >= 3840) document.documentElement.classList.add('resolution-4k');
  else if (width >= 2560) document.documentElement.classList.add('resolution-2k');
  else if (width >= 1920) document.documentElement.classList.add('resolution-full-hd');
  
  // Optimize all canvas and PPG-related elements
  document.querySelectorAll('canvas, .ppg-graph, .ppg-signal-meter').forEach(el => {
    if (el instanceof HTMLElement) {
      optimizeElement(el);
    }
  });
};


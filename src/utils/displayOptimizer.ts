
/**
 * Functions for optimizing display of signal and arrhythmia data
 */

/**
 * Get the appropriate color for the signal based on arrhythmia status
 * @param isArrhythmia - Whether the point represents arrhythmia (1 for true, 0 for false)
 */
export const getSignalColor = (isArrhythmia: number | boolean): string => {
  // Convert to boolean if needed
  const isArrhythmiaBoolean = isArrhythmia === 1 || isArrhythmia === true;
  return isArrhythmiaBoolean ? '#FF2E2E' : '#0EA5E9';
};

/**
 * Check if a point falls within any arrhythmia window
 * @param pointTime - The timestamp of the point
 * @param arrhythmiaWindows - Array of arrhythmia start/end time windows
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
 * Check if device is mobile
 */
export const isMobileDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

/**
 * Optimize canvas for high DPI displays
 */
export const optimizeCanvas = (canvas: HTMLCanvasElement): void => {
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // Get the device pixel ratio
  const dpr = window.devicePixelRatio || 1;
  
  // Get the size the canvas is displayed
  const rect = canvas.getBoundingClientRect();
  
  // Set the canvas dimensions scaled by the device pixel ratio
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  
  // Scale the context
  ctx.scale(dpr, dpr);
  
  // Set CSS size explicitly
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
};

/**
 * Optimize DOM element for rendering
 */
export const optimizeElement = (element: HTMLElement): void => {
  if (!element) return;
  
  // Add GPU acceleration
  element.style.transform = 'translateZ(0)';
  element.style.backfaceVisibility = 'hidden';
  element.style.perspective = '1000px';
  
  // Prevent layout shifts
  element.style.contain = 'layout paint';
  
  // Add optimization classes
  element.classList.add('optimized-render');
};

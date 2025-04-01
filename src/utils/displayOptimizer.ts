
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
 * Get colors for arrhythmia pulse animation
 * Direct visualization only - no simulation or manipulation
 */
export const getArrhythmiaPulseColors = (): { start: string, end: string } => {
  return {
    start: '#FFDA00',
    end: '#FF2E2E'
  };
};

/**
 * Smoothly interpolate between normal and arrhythmia colors for continuous transition
 * @param isArrhythmia Current arrhythmia state
 * @param transitionProgress Value between 0-1 for transition phase
 * @returns Interpolated color string
 */
export const getTransitionColor = (isArrhythmia: boolean, transitionProgress: number = 0): string => {
  const normalColor = { r: 14, g: 165, b: 233 }; // #0EA5E9
  const arrhythmiaColor = { r: 255, g: 46, b: 46 }; // #FF2E2E
  
  // If not in transition, return the standard color
  if (transitionProgress <= 0) return getSignalColor(isArrhythmia);
  if (transitionProgress >= 1) return getSignalColor(!isArrhythmia);
  
  // Interpolate between colors
  let r, g, b;
  if (isArrhythmia) {
    // Transitioning from normal to arrhythmia
    r = Math.round(normalColor.r + (arrhythmiaColor.r - normalColor.r) * transitionProgress);
    g = Math.round(normalColor.g + (arrhythmiaColor.g - normalColor.g) * transitionProgress);
    b = Math.round(normalColor.b + (arrhythmiaColor.b - normalColor.b) * transitionProgress);
  } else {
    // Transitioning from arrhythmia to normal
    r = Math.round(arrhythmiaColor.r + (normalColor.r - arrhythmiaColor.r) * transitionProgress);
    g = Math.round(arrhythmiaColor.g + (normalColor.g - arrhythmiaColor.g) * transitionProgress);
    b = Math.round(arrhythmiaColor.b + (normalColor.b - arrhythmiaColor.b) * transitionProgress);
  }
  
  return `rgb(${r}, ${g}, ${b})`;
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
 * Optimizes canvas for high DPI displays
 * No data manipulation, just display optimization
 */
export const optimizeCanvas = (canvas: HTMLCanvasElement, width: number, height: number): void => {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(dpr, dpr);
  }
};

/**
 * Optimizes DOM element for high performance rendering
 * No data manipulation, just display optimization
 */
export const optimizeElement = (element: HTMLElement): void => {
  element.style.transform = 'translate3d(0,0,0)';
  element.style.backfaceVisibility = 'hidden';
  element.style.willChange = 'transform';
  
  // Using standard properties only
  element.style.textRendering = 'optimizeSpeed';
};

/**
 * Check if device is mobile
 * For display optimization only
 */
export const isMobileDevice = (): boolean => {
  const userAgent = navigator.userAgent.toLowerCase();
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
};

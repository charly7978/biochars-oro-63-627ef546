
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
 * Get pulse animation colors for arrhythmia
 * Direct visualization only - no simulation or manipulation
 */
export const getArrhythmiaPulseColors = (): {start: string, end: string} => {
  return {
    start: '#FFDA00', // Amarillo
    end: '#FF2E2E'    // Rojo
  };
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
    // Mejora de renderizado para líneas suaves
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
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

/**
 * Crea un gradiente de color entre dos colores para transiciones suaves
 * Solo para visualización - sin manipulación de datos
 */
export const createColorGradient = (
  ctx: CanvasRenderingContext2D, 
  startX: number, 
  startY: number, 
  endX: number, 
  endY: number, 
  startColor: string, 
  endColor: string
): CanvasGradient => {
  const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
  gradient.addColorStop(0, startColor);
  gradient.addColorStop(1, endColor);
  return gradient;
};

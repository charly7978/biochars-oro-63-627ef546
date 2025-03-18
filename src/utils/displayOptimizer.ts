
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
 * Optimizes canvas for high DPI displays
 * No data manipulation, just display optimization
 */
export const optimizeCanvas = (canvas: HTMLCanvasElement, width: number, height: number): void => {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  if (ctx) {
    ctx.scale(dpr, dpr);
    
    // Optimizaciones adicionales para mejor rendimiento
    if ('imageSmoothingEnabled' in ctx) {
      ctx.imageSmoothingEnabled = false;
    }
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
  
  // Desactivar antialiasing para mejor rendimiento
  element.style.imageRendering = 'optimizeSpeed';
  element.style.textRendering = 'optimizeSpeed';
  
  // Forzar aceleración de hardware
  element.style.contain = 'layout paint size';
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
 * Función para optimizar el dibujado de trazos en canvas
 * Mejora significativamente el rendimiento
 */
export const optimizeCanvasDrawing = (ctx: CanvasRenderingContext2D): void => {
  // Deshabilitar antialiasing para mejor rendimiento
  if ('imageSmoothingEnabled' in ctx) {
    ctx.imageSmoothingEnabled = false;
  }
  
  // Optimizar trazado
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  
  // Reducir calidad de las sombras en dispositivos de bajo rendimiento
  if (isMobileDevice()) {
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  }
};

/**
 * Función para minimizar la sobrecarga de dibujado
 * @returns true si es momento de dibujar, false si debe saltarse este frame
 */
export const shouldSkipFrame = (
  lastRenderTime: number,
  targetFPS: number = 30
): boolean => {
  const now = performance.now();
  const minFrameTime = 1000 / targetFPS;
  
  return (now - lastRenderTime) < minFrameTime;
};

/**
 * Crea un buffer para suavizar el movimiento del gráfico
 * No manipula los datos, solo optimiza la visualización
 */
export const createSmoothBuffer = (value: number, lastValue: number, factor: number = 0.4): number => {
  if (lastValue === null || lastValue === undefined) return value;
  return lastValue + factor * (value - lastValue);
};

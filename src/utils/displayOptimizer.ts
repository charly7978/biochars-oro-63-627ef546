
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
  
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(dpr, dpr);
    
    // Mejorar calidad de rendering
    if (typeof ctx.imageSmoothingEnabled !== 'undefined') {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }
    
    // Optimizar para líneas
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
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
  
  // Prevenir antialiasing para mejor rendimiento
  element.style.fontKerning = 'none';
  
  // Habilitar aceleración por hardware
  element.classList.add('performance-boost');
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
 * Optimiza el dibujo de líneas para garantizar continuidad
 * No manipula datos, solo optimiza visualización
 */
export const optimizeLineDrawing = (
  ctx: CanvasRenderingContext2D,
  points: Array<{x: number, y: number}>,
  color: string,
  lineWidth: number = 2
): void => {
  if (points.length < 2) return;
  
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  
  // Añadir sombra suave para mejorar visibilidad
  ctx.shadowBlur = 1;
  ctx.shadowColor = color;
  
  // Dibujar con interpolación para suavizado adicional
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    
    if (i === 0) {
      ctx.moveTo(point.x, point.y);
    } else if (i < points.length - 1) {
      // Para líneas más suaves, usar curvas Bezier
      const nextPoint = points[i+1];
      const xc = (point.x + nextPoint.x) / 2;
      const yc = (point.y + nextPoint.y) / 2;
      ctx.quadraticCurveTo(point.x, point.y, xc, yc);
    } else {
      // El último punto
      ctx.lineTo(point.x, point.y);
    }
  }
  
  ctx.stroke();
  ctx.shadowBlur = 0;
};

/**
 * Genera un gradiente suave para el fondo de gráficos
 * Puramente visual, no afecta datos
 */
export const createGraphGradient = (
  ctx: CanvasRenderingContext2D, 
  width: number, 
  height: number
): CanvasGradient => {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#E2DCFF');
  gradient.addColorStop(0.25, '#FFDECF');
  gradient.addColorStop(0.45, '#F1FBDF');
  gradient.addColorStop(0.55, '#F1EEE8');
  gradient.addColorStop(0.75, '#F5EED8');
  gradient.addColorStop(1, '#F5EED0');
  return gradient;
};

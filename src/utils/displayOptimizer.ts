
/**
 * Utilidades para optimización de visualización en diferentes dispositivos
 * Este archivo maneja las adaptaciones necesarias para diferentes densidades de píxeles
 */

/**
 * Verifica si el dispositivo actual es móvil
 */
export const isMobileDevice = (): boolean => {
  const userAgent = navigator.userAgent.toLowerCase();
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
};

/**
 * Optimiza un elemento canvas para dispositivos de alta resolución
 * @param canvas Elemento canvas a optimizar
 * @param width Ancho deseado
 * @param height Alto deseado
 */
export const optimizeCanvas = (canvas: HTMLCanvasElement, width: number, height: number): void => {
  const dpr = window.devicePixelRatio || 1;
  
  // Establecer las dimensiones del elemento canvas
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  
  // Ajustar el contexto para la escala
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(dpr, dpr);
  }
};

/**
 * Optimiza cualquier elemento HTML para mostrar correctamente en dispositivos de alta resolución
 * @param element Elemento a optimizar
 */
export const optimizeElement = (element: HTMLElement): void => {
  const dpr = window.devicePixelRatio || 1;
  
  if (dpr > 1) {
    // Aplicar estilos para mejorar la nitidez en pantallas de alta densidad
    element.style.transform = 'translateZ(0)';
    element.style.backfaceVisibility = 'hidden';
  }
};

/**
 * Determina el factor de escala óptimo para un dispositivo
 */
export const getOptimalScaleFactor = (): number => {
  const dpr = window.devicePixelRatio || 1;
  
  // Limitar el factor de escala para dispositivos de muy alta densidad
  return Math.min(dpr, 2.5);
};

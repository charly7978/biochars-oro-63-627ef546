
/**
 * Helper functions for optimizing display elements
 */

export const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const optimizeCanvas = (canvas: HTMLCanvasElement): void => {
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }
};

export const optimizeElement = (element: HTMLElement): void => {
  // Apply performance optimizations for DOM elements
  element.style.willChange = 'transform';
  element.style.transform = 'translateZ(0)';
};

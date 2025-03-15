
/**
 * Utility functions for optimizing display rendering on various screen densities
 * Versión optimizada para Android con enfoque en rendimiento
 */

// Detectar si es un dispositivo Android
export const isAndroidDevice = (): boolean => {
  return typeof window !== 'undefined' && 
         /Android/i.test(window.navigator.userAgent);
};

// Check if the device has a high-DPI display
export const isHighDpiDisplay = (): boolean => {
  return window.devicePixelRatio > 1;
};

// Get the current device pixel ratio
export const getDevicePixelRatio = (): number => {
  // En Android limitamos el ratio para mejorar rendimiento
  if (isAndroidDevice() && window.devicePixelRatio > 2) {
    return 2; // Limitar ratio en Android para mejor rendimiento
  }
  return window.devicePixelRatio || 1;
};

// Optimize a canvas for the device's pixel ratio with Android optimizations
export const optimizeCanvas = (canvas: HTMLCanvasElement): void => {
  const ctx = canvas.getContext('2d', { 
    alpha: false, // Desactivar alpha para mejorar rendimiento
    desynchronized: true // Usar desynchronized rendering cuando sea posible
  });
  if (!ctx) return;
  
  const dpr = isAndroidDevice() ? Math.min(getDevicePixelRatio(), 2) : getDevicePixelRatio();
  const rect = canvas.getBoundingClientRect();
  
  // En Android, reducimos la resolución para mejorar rendimiento
  const scaleFactor = isAndroidDevice() ? 0.8 : 1;
  
  // Set the canvas dimensions accounting for the device pixel ratio
  canvas.width = rect.width * dpr * scaleFactor;
  canvas.height = rect.height * dpr * scaleFactor;
  
  // Scale the context to ensure correct drawing operations
  ctx.scale(dpr * scaleFactor, dpr * scaleFactor);
  
  // Apply high-performance rendering settings
  ctx.imageSmoothingEnabled = !isAndroidDevice(); // Desactivar en Android
  
  // Set the CSS width and height to the original dimensions
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  
  // Optimizaciones específicas para Android
  if (isAndroidDevice()) {
    // Forzar aceleración de hardware
    canvas.style.transform = 'translateZ(0)';
    canvas.style.willChange = 'transform';
    // Reducir calidad visual a cambio de mejor rendimiento
    ctx.lineWidth = Math.max(1, Math.floor(ctx.lineWidth));
  }
};

// Apply performance optimizations to DOM elements
export const applyPerformanceOptimizations = (element: HTMLElement): void => {
  // Apply hardware acceleration
  element.style.transform = 'translate3d(0, 0, 0)';
  element.style.backfaceVisibility = 'hidden';
  
  // Optimización para Android: solo usar willChange cuando sea necesario
  if (!isAndroidDevice()) {
    element.style.willChange = 'transform';
  }
  
  // Apply performance classes
  element.classList.add('performance-boost');
  
  // Si es Android, aplicar optimizaciones específicas
  if (isAndroidDevice()) {
    element.classList.add('android-optimized');
  }
  
  // If this is a graph or visualization, apply additional optimizations
  if (
    element.classList.contains('ppg-signal-meter') || 
    element.classList.contains('graph-container') ||
    element.tagName.toLowerCase() === 'canvas'
  ) {
    element.classList.add('ppg-graph');
    
    // En Android, usar contain más restrictivo
    if (isAndroidDevice()) {
      element.style.contain = 'layout paint size';
    } else {
      element.style.contain = 'strict';
    }
  }
};

// Apply text rendering optimizations
export const optimizeTextRendering = (element: HTMLElement): void => {
  // En Android, usar configuraciones más simples
  if (isAndroidDevice()) {
    element.style.textRendering = 'optimizeSpeed';
  } else {
    element.style.textRendering = 'geometricPrecision';
  }
  
  if (isHighDpiDisplay() && !isAndroidDevice()) {
    // Fix for TypeScript error - usando setAttribute instead of direct property assignment
    element.setAttribute('style', element.getAttribute('style') + ' -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;');
  }
  
  // For numeric displays that need to be particularly crisp
  if (
    element.classList.contains('vital-display') || 
    element.classList.contains('precision-number')
  ) {
    // Simplificar configuraciones en Android
    if (isAndroidDevice()) {
      element.style.fontVariantNumeric = 'tabular-nums';
    } else {
      element.style.fontFeatureSettings = '"tnum", "zero"';
      element.style.fontVariantNumeric = 'tabular-nums';
      element.style.letterSpacing = '-0.02em';
    }
  }
};

// Nuevo: función para throttling de operaciones intensivas
export const throttle = <T extends (...args: any[]) => any>(
  func: T, 
  limit: number
): ((...args: Parameters<T>) => ReturnType<T> | undefined) => {
  let inThrottle: boolean = false;
  let lastResult: ReturnType<T> | undefined;
  
  return function(this: any, ...args: Parameters<T>): ReturnType<T> | undefined {
    if (!inThrottle) {
      lastResult = func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
    return lastResult;
  };
};

// Nuevo: función para debounce de operaciones intensivas
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: number | undefined;
  
  return function(this: any, ...args: Parameters<T>): void {
    const later = () => {
      timeout = undefined;
      func.apply(this, args);
    };
    
    clearTimeout(timeout);
    timeout = window.setTimeout(later, wait);
  };
};

// Apply all optimizations to an element and its children with Android-specific optimizations
export const optimizeElement = (element: HTMLElement): void => {
  applyPerformanceOptimizations(element);
  optimizeTextRendering(element);
  
  // En Android, procesar menos elementos hijos para mejorar rendimiento
  const maxChildren = isAndroidDevice() ? 20 : 100;
  const childElements = Array.from(element.children).slice(0, maxChildren);
  
  // Recursively optimize all child elements
  childElements.forEach(child => {
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

// Nuevo: Optimizar renderizado de canvas para Android
export const optimizeCanvasRendering = (
  draw: (ctx: CanvasRenderingContext2D, timestamp: number) => void,
  canvas: HTMLCanvasElement
): (() => void) => {
  let animationId: number | null = null;
  let lastFrameTime = 0;
  const targetFPS = isAndroidDevice() ? 30 : 60; // Limitar FPS en Android
  const frameInterval = 1000 / targetFPS;
  
  const render = (timestamp: number) => {
    animationId = requestAnimationFrame(render);
    
    const elapsed = timestamp - lastFrameTime;
    if (elapsed < frameInterval) return;
    
    lastFrameTime = timestamp - (elapsed % frameInterval);
    
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    
    draw(ctx, timestamp);
  };
  
  // Iniciar renderizado
  animationId = requestAnimationFrame(render);
  
  // Retornar función para detener renderizado
  return () => {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  };
};

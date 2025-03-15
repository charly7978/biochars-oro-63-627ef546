
/**
 * Utility functions for optimizing display rendering on various screen densities
 */

// Detecta si el dispositivo es Android
export const isAndroidDevice = (): boolean => {
  return /android/i.test(navigator.userAgent);
};

// Comprueba si el dispositivo es de baja potencia
export const isLowPowerDevice = (): boolean => {
  // Heurística simple basada en el número de núcleos lógicos
  const cpuCores = navigator.hardwareConcurrency || 4;
  return cpuCores <= 4 || isAndroidDevice();
};

// Check if the device has a high-DPI display
export const isHighDpiDisplay = (): boolean => {
  return window.devicePixelRatio > 1;
};

// Get the current device pixel ratio
export const getDevicePixelRatio = (): number => {
  // Para dispositivos Android, limitamos el DPR a un máximo de 2
  // para evitar sobrecarga en el renderizado
  if (isAndroidDevice() && window.devicePixelRatio > 2) {
    return 2;
  }
  return window.devicePixelRatio || 1;
};

// Optimize a canvas for the device's pixel ratio
export const optimizeCanvas = (canvas: HTMLCanvasElement): void => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // Obtener DPR optimizado para el dispositivo
  const dpr = isLowPowerDevice() ? Math.min(getDevicePixelRatio(), 1.5) : getDevicePixelRatio();
  const rect = canvas.getBoundingClientRect();
  
  // Ajustar tamaño para dispositivos Android
  if (isAndroidDevice()) {
    // Reducir tamaño ligeramente en Android para mejorar rendimiento
    canvas.width = Math.floor(rect.width * dpr * 0.9);
    canvas.height = Math.floor(rect.height * dpr * 0.9);
  } else {
    // Mantener configuración original para otros dispositivos
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
  }
  
  // Scale the context to ensure correct drawing operations
  ctx.scale(dpr, dpr);
  
  // Apply high-performance rendering settings
  ctx.imageSmoothingEnabled = !isLowPowerDevice(); // Desactivar en dispositivos de baja potencia
  
  // Set the CSS width and height to the original dimensions
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
};

// Determina el intervalo óptimo para actualizaciones de UI
export const getOptimalUIUpdateInterval = (): number => {
  if (isAndroidDevice()) {
    return 100; // 10 FPS en Android para ahorrar recursos
  }
  return 33; // ~30 FPS en otros dispositivos
};

// Apply performance optimizations to DOM elements
export const applyPerformanceOptimizations = (element: HTMLElement): void => {
  // Apply hardware acceleration
  element.style.transform = 'translate3d(0, 0, 0)';
  element.style.backfaceVisibility = 'hidden';
  
  // En dispositivos Android, usar propiedades will-change con precaución
  if (!isAndroidDevice()) {
    element.style.willChange = 'transform';
  }
  
  // Apply performance classes
  element.classList.add('performance-boost');
  
  // If this is a graph or visualization, apply additional optimizations
  if (
    element.classList.contains('ppg-signal-meter') || 
    element.classList.contains('graph-container') ||
    element.tagName.toLowerCase() === 'canvas'
  ) {
    element.classList.add('ppg-graph');
    
    // Contain solo en dispositivos no-Android
    if (!isAndroidDevice()) {
      element.style.contain = 'strict';
    } else {
      element.style.contain = 'content';
    }
  }
};

// Apply text rendering optimizations
export const optimizeTextRendering = (element: HTMLElement): void => {
  // En Android, usar configuraciones básicas que no sobrecarguen el rendimiento
  if (isAndroidDevice()) {
    element.style.textRendering = 'optimizeSpeed';
    return;
  }
  
  // Configuración completa solo para dispositivos no-Android
  element.style.textRendering = 'geometricPrecision';
  
  if (isHighDpiDisplay()) {
    // Fix for TypeScript error - using setAttribute instead of direct property assignment
    element.setAttribute('style', element.getAttribute('style') + ' -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;');
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
  
  // Reducir recursión en Android para evitar sobrecarga
  if (isAndroidDevice()) {
    // Solo optimizar los primeros hijos directos (no recursivo)
    Array.from(element.children).forEach(child => {
      if (child instanceof HTMLElement) {
        applyPerformanceOptimizations(child);
        optimizeTextRendering(child);
      }
      
      if (child instanceof HTMLCanvasElement) {
        optimizeCanvas(child);
      }
    });
  } else {
    // En otros dispositivos, mantener la optimización recursiva completa
    Array.from(element.children).forEach(child => {
      if (child instanceof HTMLElement) {
        optimizeElement(child);
      }
      
      if (child instanceof HTMLCanvasElement) {
        optimizeCanvas(child);
      }
    });
  }
};

// Helper to apply all optimizations to a specific selector
export const optimizeSelector = (selector: string): void => {
  const elements = document.querySelectorAll<HTMLElement>(selector);
  elements.forEach(optimizeElement);
};

// Throttle para limitar la frecuencia de ejecución de funciones intensivas
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  };
};

// Obtener un factor de escala adaptativo basado en el dispositivo
export const getAdaptiveScaleFactor = (): number => {
  if (isAndroidDevice()) {
    return 0.85; // Reducir carga en Android
  }
  return 1.0; // Factor completo para otros dispositivos
};

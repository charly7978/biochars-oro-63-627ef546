
/**
 * Utilidades de optimización específicas para pantallas de alta resolución
 */

import { isMobileDevice } from './displayOptimizer';

/**
 * Detecta si el dispositivo tiene una pantalla de alta resolución
 */
export const isHighResolutionDisplay = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.devicePixelRatio > 1.5;
};

/**
 * Detecta si el dispositivo tiene una pantalla de ultra alta resolución (4K+)
 */
export const isUltraHighResolutionDisplay = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // Detecta 4K o superior basado en la resolución
  const width = window.screen.width * window.devicePixelRatio;
  const height = window.screen.height * window.devicePixelRatio;
  
  return (width >= 3840 || height >= 2160) && window.devicePixelRatio >= 2;
};

/**
 * Aplicar la máxima resolución posible para la pantalla actual
 */
export const applyMaximumResolution = (): void => {
  if (typeof window === 'undefined') return;
  
  // Obtener detalles de la pantalla
  const pixelRatio = window.devicePixelRatio || 1;
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  
  console.log('Applying maximum resolution settings', {
    devicePixelRatio: pixelRatio,
    screenWidth,
    screenHeight,
    calculatedResolution: `${screenWidth * pixelRatio}x${screenHeight * pixelRatio}`
  });
  
  // Establecer variables CSS para acceder desde estilos
  document.documentElement.style.setProperty('--device-pixel-ratio', pixelRatio.toString());
  document.documentElement.style.setProperty('--screen-width', `${screenWidth}px`);
  document.documentElement.style.setProperty('--screen-height', `${screenHeight}px`);
  document.documentElement.style.setProperty('--true-width', `${screenWidth * pixelRatio}px`);
  document.documentElement.style.setProperty('--true-height', `${screenHeight * pixelRatio}px`);
  
  // Forzar renderizado a máxima resolución
  if (pixelRatio > 1) {
    document.documentElement.classList.add('maximum-resolution');
    
    // Clasificar según la densidad de píxeles
    if (pixelRatio >= 4) {
      document.documentElement.classList.add('ultra-high-dpi');
    } else if (pixelRatio >= 3) {
      document.documentElement.classList.add('very-high-dpi');
    } else if (pixelRatio >= 2) {
      document.documentElement.classList.add('high-dpi');
    }
    
    // Clasificar según la resolución física
    const physicalWidth = screenWidth * pixelRatio;
    if (physicalWidth >= 7680) {
      document.documentElement.classList.add('display-8k');
    } else if (physicalWidth >= 5120) {
      document.documentElement.classList.add('display-5k');
    } else if (physicalWidth >= 3840) {
      document.documentElement.classList.add('display-4k');
    } else if (physicalWidth >= 2560) {
      document.documentElement.classList.add('display-2k');
    } else if (physicalWidth >= 1920) {
      document.documentElement.classList.add('display-full-hd');
    }
  }
  
  // Optimizar elementos críticos
  const criticalElements = document.querySelectorAll('.ppg-graph, .ppg-signal-meter, canvas, video');
  criticalElements.forEach(el => {
    if (el instanceof HTMLElement) {
      el.classList.add('maximum-resolution');
      el.style.imageRendering = 'pixelated';
      el.style.imageRendering = '-webkit-optimize-contrast';
      
      // Evitar suavizado para elementos gráficos
      if (el instanceof HTMLCanvasElement) {
        const ctx = el.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          
          // Establecer el tamaño real considerando el pixel ratio
          const rect = el.getBoundingClientRect();
          el.width = rect.width * pixelRatio;
          el.height = rect.height * pixelRatio;
          el.style.width = `${rect.width}px`;
          el.style.height = `${rect.height}px`;
          ctx.scale(pixelRatio, pixelRatio);
        }
      }
    }
  });
  
  // Para dispositivos Apple
  if (/iPhone|iPad|iPod|Mac/.test(navigator.userAgent)) {
    document.documentElement.classList.add('apple-device');
    document.documentElement.classList.add('retina-optimization');
  }
  
  console.log('Maximum resolution settings applied');
};

/**
 * Aplica optimizaciones específicas para pantallas de alta resolución
 */
export const applyHighResolutionOptimizations = (): void => {
  if (!isHighResolutionDisplay()) return;
  
  // Agrega las clases para optimización
  document.documentElement.classList.add('high-res-optimized');
  
  // Para pantallas ultra alta resolución, aplicamos optimizaciones más agresivas
  if (isUltraHighResolutionDisplay()) {
    document.documentElement.classList.add('ultra-high-resolution');
    
    // Si no es móvil, aplicamos optimizaciones específicas para pantallas grandes
    if (!isMobileDevice()) {
      document.documentElement.classList.add('ultra-crisp-rendering');
    }
  }
  
  // Aplica máxima resolución
  applyMaximumResolution();
  
  console.log('Optimizaciones para alta resolución aplicadas');
};

/**
 * Optimiza elementos con datos médicos para pantallas de alta resolución
 */
export const optimizeMedicalDataDisplay = (element: HTMLElement): void => {
  if (!element) return;
  
  // Aplicar las clases de optimización tipográfica
  element.classList.add('typography-medical-data');
  
  // Para dispositivos de alta resolución, agregamos más optimizaciones
  if (isHighResolutionDisplay()) {
    element.classList.add('high-res-optimized');
    
    // Aseguramos que las características tipográficas numéricas estén habilitadas
    element.style.fontFeatureSettings = '"tnum", "salt", "ss01", "cv01", "cv03"';
    element.style.fontVariantNumeric = 'tabular-nums';
    
    // Agregamos sombra de texto sutil para mejorar legibilidad en pantallas de alta densidad
    if (isUltraHighResolutionDisplay()) {
      element.style.textShadow = '0 0 1px rgba(0,0,0,0.05)';
    }
  }
};

/**
 * Aplica las mejores prácticas de CSS Grid para interfaces médicas responsivas
 */
export const applyMedicalGridLayout = (container: HTMLElement): void => {
  if (!container) return;
  
  // Aplicar estilos de grid
  container.classList.add('grid-dashboard');
  
  // Optimizaciones para contenedor
  container.style.contain = 'layout style';
  
  // En dispositivos de alta resolución, mejoramos la calidad visual
  if (isHighResolutionDisplay()) {
    container.classList.add('ultra-crisp-rendering');
    applyMaximumResolution();
  }
};

/**
 * Configura Container Queries para componentes médicos adaptativos
 * @returns A cleanup function that can be used to disconnect the observer
 */
export const setupContainerQueries = (): (() => void) => {
  if (typeof window === 'undefined' || !('ResizeObserver' in window)) {
    return () => {}; // Return an empty function as fallback
  }
  
  // Identificamos los contenedores que deben ser adaptables
  const containers = document.querySelectorAll('.container-query');
  
  // Configurar el ResizeObserver para simular container queries
  const resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const container = entry.target as HTMLElement;
      const width = entry.contentRect.width;
      
      // Remover clases previas
      container.classList.remove('cq-sm', 'cq-md', 'cq-lg', 'cq-xl');
      
      // Aplicar clases basadas en el ancho del contenedor
      if (width < 400) {
        container.classList.add('cq-sm');
      } else if (width < 600) {
        container.classList.add('cq-md');
      } else if (width < 900) {
        container.classList.add('cq-lg');
      } else {
        container.classList.add('cq-xl');
      }
    }
  });
  
  // Observar cada contenedor
  containers.forEach(container => {
    resizeObserver.observe(container);
  });
  
  return () => {
    resizeObserver.disconnect();
  };
};


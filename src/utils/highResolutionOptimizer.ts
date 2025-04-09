
/**
 * Utilidades de optimización específicas para pantallas de alta resolución
 */

/**
 * Check if the current device is a mobile device
 */
const isMobileDeviceCheck = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

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
    if (!isMobileDeviceCheck()) {
      document.documentElement.classList.add('ultra-crisp-rendering');
    }
  }
  
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

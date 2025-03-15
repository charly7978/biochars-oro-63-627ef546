
/**
 * Utilidades para optimizar la visualización en pantalla
 */

/**
 * Intenta activar el modo inmersivo/pantalla completa
 */
export const enterImmersiveMode = async (): Promise<void> => {
  try {
    const elem = document.documentElement;
    
    if (elem.requestFullscreen) {
      await elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
      await elem.webkitRequestFullscreen();
    } else if ((elem as any).mozRequestFullScreen) {
      await (elem as any).mozRequestFullScreen();
    } else if ((elem as any).msRequestFullscreen) {
      await (elem as any).msRequestFullscreen();
    }
    
    // Intentar ocultar la barra de navegación en Android
    if (window.navigator.userAgent.match(/Android/i)) {
      if ((window as any).AndroidFullScreen) {
        (window as any).AndroidFullScreen.immersiveMode(
          () => console.log('Immersive mode enabled'),
          () => console.log('Failed to enable immersive mode')
        );
      }
    }
  } catch (err) {
    console.log('Error al entrar en pantalla completa:', err);
  }
};

/**
 * Optimiza la interfaz basada en la resolución de pantalla
 */
export const optimizeForScreenResolution = (): void => {
  // Determinar el DPI/densidad de pixeles
  const pixelRatio = window.devicePixelRatio || 1;
  
  // Aplicar clases basadas en la densidad de pixeles
  const rootElement = document.documentElement;
  
  if (pixelRatio > 1) {
    rootElement.classList.add('high-dpi');
    
    if (pixelRatio >= 2) {
      rootElement.classList.add('retina');
    }
    
    if (pixelRatio >= 3) {
      rootElement.classList.add('ultra-hd');
    }
  }
  
  // Optimizaciones para pantallas de alta resolución
  if (window.innerWidth >= 2048 || window.innerHeight >= 2048) {
    document.body.classList.add('high-res-interface');
  }
  
  // Optimizaciones de renderizado de texto
  document.body.style.textRendering = 'geometricPrecision';
  document.body.style.setProperty('-webkit-font-smoothing', 'antialiased');
  document.body.style.setProperty('-moz-osx-font-smoothing', 'grayscale');
  
  // Optimizar renderizado de Canvas
  const canvases = document.querySelectorAll('canvas');
  canvases.forEach(canvas => {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
    }
    
    // Aplicar mejoras de rendimiento
    canvas.style.transform = 'translateZ(0)';
    canvas.style.backfaceVisibility = 'hidden';
  });
};

/**
 * Configura observadores para mejorar el rendimiento de elementos gráficos cuando son añadidos al DOM
 */
export const setupPerformanceObservers = (): MutationObserver => {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            // Optimizar elementos canvas y gráficos PPG
            const graphElements = node.querySelectorAll('.ppg-signal-meter, canvas, svg');
            graphElements.forEach((el) => {
              if (el instanceof HTMLElement) {
                el.classList.add('ppg-graph', 'performance-boost');
                el.style.transform = 'translate3d(0, 0, 0)';
                el.style.backfaceVisibility = 'hidden';
                
                if (el instanceof HTMLCanvasElement) {
                  const ctx = el.getContext('2d');
                  if (ctx) {
                    ctx.imageSmoothingEnabled = false;
                  }
                }
              }
            });
          }
        });
      }
    });
  });
  
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
  
  return observer;
};

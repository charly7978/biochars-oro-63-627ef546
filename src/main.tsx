
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Función para configurar el modo inmersivo total
const setupImmersiveMode = () => {
  // Aplicar clase de interfaz de alta resolución
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.classList.add('high-res-interface', 'immersive-interface');
  }
  
  // Optimizar la renderización para interfaces de alta resolución
  document.body.style.textRendering = 'geometricPrecision';
  // Fix: Remove incorrect fontSmoothing property
  document.body.style.setProperty('-webkit-font-smoothing', 'antialiased');
  
  // Forzar el pixel ratio del dispositivo sea respetado
  if (window.devicePixelRatio > 1) {
    document.documentElement.style.setProperty('--device-pixel-ratio', window.devicePixelRatio.toString());
    
    // Agregar clases especiales para pantallas de alta densidad
    document.documentElement.classList.add('high-dpi');
    if (window.devicePixelRatio >= 2) {
      document.documentElement.classList.add('retina');
    }
    if (window.devicePixelRatio >= 3) {
      document.documentElement.classList.add('ultra-hd');
    }
  }
  
  // Configurar para diferentes tamaños de pantalla
  const setOptimalRendering = () => {
    if (window.screen.width >= 3840 || window.screen.height >= 3840) {
      document.documentElement.classList.add('display-4k');
    }
    else if (window.screen.width >= 2048 || window.screen.height >= 2048) {
      document.documentElement.classList.add('display-2k');
    }
  };
  
  setOptimalRendering();
  
  // Deshabilitar gestos del navegador y pantalla táctil que puedan interferir
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) {
      e.preventDefault(); // Prevenir zoom con pinch
    }
  }, { passive: false });
  
  document.addEventListener('gesturestart', (e) => {
    e.preventDefault(); // Prevenir gestos en Safari
  }, { passive: false });
  
  // Prevenir doble-tap para zoom
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd < 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
};

// Solicitar pantalla completa de forma agresiva
const requestFullscreenAggressively = () => {
  try {
    const docElem = document.documentElement;
    
    // Ocultar la barra de navegación
    // Fix: Remove incorrect setOverlayScrollbars method call
    if ('scrollbars' in document.documentElement.style) {
      document.documentElement.style.scrollbars = 'none';
    }
    
    // Configurar viewport para maximizar área útil
    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (metaViewport) {
      metaViewport.setAttribute('content', 
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, target-densitydpi=device-dpi');
    }
    
    // Activar pantalla completa con diferentes métodos
    if (docElem.requestFullscreen) {
      docElem.requestFullscreen({ navigationUI: "hide" } as any);
    } else if ((docElem as any).webkitRequestFullscreen) {
      (docElem as any).webkitRequestFullscreen();
    } else if ((docElem as any).msRequestFullscreen) {
      (docElem as any).msRequestFullscreen();
    }
    
    // Bloquear orientación a retrato si es posible
    if (window.screen && window.screen.orientation && window.screen.orientation.lock) {
      window.screen.orientation.lock('portrait')
        .catch(err => console.log('No se pudo bloquear la orientación:', err));
    }
    
    // Apagar tiempo de inactividad de la pantalla si es posible
    if ((navigator as any).wakeLock) {
      (navigator as any).wakeLock.request('screen')
        .catch(err => console.log('No se pudo mantener la pantalla encendida:', err));
    }
  } catch (err) {
    console.error('Error al configurar pantalla completa:', err);
  }
};

// Inicializar inmediatamente
setupImmersiveMode();
requestFullscreenAggressively();

// Asegurar pantalla completa en cada interacción del usuario hasta conseguirla
let isFullscreen = false;
const handleUserInteraction = () => {
  isFullscreen = document.fullscreenElement !== null;
  if (!isFullscreen) {
    requestFullscreenAggressively();
  } else {
    document.removeEventListener('click', handleUserInteraction);
    document.removeEventListener('touchstart', handleUserInteraction);
  }
};

// Añadir listeners para la interacción del usuario
document.addEventListener('click', handleUserInteraction);
document.addEventListener('touchstart', handleUserInteraction);

// Manejar cambios en la orientación y tamaño de pantalla
window.addEventListener('resize', setupImmersiveMode);
window.addEventListener('orientationchange', () => {
  setupImmersiveMode();
  requestFullscreenAggressively();
});

// Optimizar rendimiento gráfico con MutationObserver
const setupPerformanceOptimizer = () => {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            // Encontrar elementos de gráficos PPG y optimizarlos
            const graphElements = node.querySelectorAll('.ppg-signal-meter, canvas, svg');
            graphElements.forEach((el) => {
              if (el instanceof HTMLElement) {
                el.classList.add('ppg-graph', 'gpu-accelerated', 'rendering-optimized', 'hyper-performance');
                el.style.willChange = 'transform, opacity';
                el.style.transform = 'translateZ(0)';
                
                if (el instanceof HTMLCanvasElement) {
                  const ctx = el.getContext('2d', {
                    alpha: false,
                    desynchronized: true
                  });
                  
                  if (ctx) {
                    ctx.imageSmoothingEnabled = false;
                    ctx.imageSmoothingQuality = 'low';
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

// Iniciar el optimizador de rendimiento después del renderizado
window.addEventListener('DOMContentLoaded', setupPerformanceOptimizer);

// Renderizar la aplicación
createRoot(document.getElementById("root")!).render(<App />);

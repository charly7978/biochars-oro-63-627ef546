
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { applyMaximumResolution, applyHighResolutionOptimizations } from './utils/highResolutionOptimizer'

// Apply high-resolution interface class to the root element
const applyHighResolution = () => {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.classList.add('high-res-interface');
  }
  
  // Apply high-DPI rendering for crisp text and UI
  document.body.style.textRendering = 'geometricPrecision';
  
  try {
    // Apply maximum resolution settings
    applyMaximumResolution();
    applyHighResolutionOptimizations();
  } catch (err) {
    console.warn('Error applying high resolution settings:', err);
    // Continue app execution even if optimization fails
  }
  
  // Force device pixel ratio to be respected
  if (window.devicePixelRatio > 1) {
    // Create a CSS variable with the device pixel ratio for use in styles
    document.documentElement.style.setProperty('--device-pixel-ratio', window.devicePixelRatio.toString());
    
    // Add special classes for high-DPI displays
    document.documentElement.classList.add('high-dpi');
    if (window.devicePixelRatio >= 2) {
      document.documentElement.classList.add('retina');
    }
    if (window.devicePixelRatio >= 3) {
      document.documentElement.classList.add('ultra-hd');
    }
  }
  
  // Set optimal rendering settings based on device capabilities
  const setOptimalRendering = () => {
    try {
      // For 8K displays
      if (window.screen.width >= 7680 || window.screen.height >= 4320) {
        document.documentElement.classList.add('display-8k');
      }
      // For 5K displays
      else if (window.screen.width >= 5120 || window.screen.height >= 2880) {
        document.documentElement.classList.add('display-5k');
      }
      // For 4K displays
      else if (window.screen.width >= 3840 || window.screen.height >= 2160) {
        document.documentElement.classList.add('display-4k');
      }
      // For 2K/Retina displays
      else if (window.screen.width >= 2048 || window.screen.height >= 2048) {
        document.documentElement.classList.add('display-2k');
      }
    } catch (err) {
      console.warn('Error setting optimal rendering:', err);
      // Continue app execution
    }
  };
  
  setOptimalRendering();
};

// Function to request fullscreen on startup - with fallbacks
const requestFullscreenMode = () => {
  try {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen()
        .catch(err => {
          console.warn('Error attempting to enable fullscreen:', err);
          // Continue with app initialization even if fullscreen fails
        });
    }
    
    // Handle screen orientation if available
    if (window.screen && window.screen.orientation && window.screen.orientation.lock) {
      try {
        // Lock to portrait as the app is designed for it
        window.screen.orientation.lock('portrait')
          .catch(err => {
            console.warn('Failed to lock orientation:', err);
            // Continue with app initialization even if orientation lock fails
          });
      } catch (orientErr) {
        console.warn('Orientation locking not supported:', orientErr);
      }
    }
    
    // Try to set maximum resolution and prevent scaling
    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (metaViewport) {
      metaViewport.setAttribute('content', 
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, target-densitydpi=device-dpi');
    }
  } catch (err) {
    console.error('Fullscreen API not supported:', err);
    // Continue with app initialization even if fullscreen fails
  }
};

// Execute immediately BUT don't block app initialization if it fails
try {
  requestFullscreenMode();
  applyHighResolution();
} catch (e) {
  console.warn('Setup failed but continuing with app initialization:', e);
}

// Ensure we request fullscreen on user interaction - but don't block the app if it fails
let isFullscreen = false;
const checkFullscreen = () => {
  return document.fullscreenElement !== null;
};

const handleUserInteraction = () => {
  try {
    isFullscreen = checkFullscreen();
    if (!isFullscreen) {
      requestFullscreenMode();
    } else {
      // Remove listeners if we're already in fullscreen
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    }
  } catch (e) {
    console.warn('Could not handle user interaction:', e);
    // Remove listeners to prevent repeated errors
    document.removeEventListener('click', handleUserInteraction);
    document.removeEventListener('touchstart', handleUserInteraction);
  }
};

try {
  document.addEventListener('click', handleUserInteraction);
  document.addEventListener('touchstart', handleUserInteraction);
} catch (e) {
  console.warn('Could not add event listeners:', e);
}

// Handle resolution scaling on resize and orientation change
try {
  window.addEventListener('resize', () => {
    try {
      applyHighResolution();
      applyMaximumResolution();
    } catch (e) {
      console.warn('Could not apply high resolution on resize:', e);
    }
  });
  window.addEventListener('orientationchange', () => {
    try {
      applyHighResolution();
      applyMaximumResolution();
    } catch (e) {
      console.warn('Could not apply high resolution on orientation change:', e);
    }
  });
} catch (e) {
  console.warn('Could not add window event listeners:', e);
}

// Let's improve graph performance with a MutationObserver
// This will add performance classes to any PPG graph elements that are added to the DOM
const setupPerformanceObserver = () => {
  try {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              // Find PPG graph elements and apply performance optimizations
              const graphElements = node.querySelectorAll('.ppg-signal-meter, canvas, svg');
              graphElements.forEach((el) => {
                if (el instanceof HTMLElement) {
                  el.classList.add('ppg-graph', 'gpu-accelerated', 'rendering-optimized', 'maximum-resolution');
                  if (el instanceof HTMLCanvasElement) {
                    const ctx = el.getContext('2d');
                    if (ctx) {
                      ctx.imageSmoothingEnabled = false;
                      
                      // Apply maximum resolution to canvas
                      const rect = el.getBoundingClientRect();
                      const dpr = window.devicePixelRatio || 1;
                      el.width = rect.width * dpr;
                      el.height = rect.height * dpr;
                      el.style.width = `${rect.width}px`;
                      el.style.height = `${rect.height}px`;
                      ctx.scale(dpr, dpr);
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
  } catch (e) {
    console.warn('Could not setup performance observer:', e);
    return null;
  }
};

// Start the performance observer after render
try {
  window.addEventListener('DOMContentLoaded', setupPerformanceObserver);
} catch (e) {
  console.warn('Could not add DOMContentLoaded listener:', e);
}

// Render the app
try {
  const rootElement = document.getElementById("root");
  if (rootElement) {
    createRoot(rootElement).render(<App />);
  } else {
    console.error("Root element not found");
    // Try to create a root element if it doesn't exist
    const newRoot = document.createElement("div");
    newRoot.id = "root";
    document.body.appendChild(newRoot);
    createRoot(newRoot).render(<App />);
  }
} catch (e) {
  console.error("Failed to render app:", e);
  // Display error to user
  const errorDiv = document.createElement("div");
  errorDiv.style.position = "fixed";
  errorDiv.style.inset = "0";
  errorDiv.style.backgroundColor = "#000";
  errorDiv.style.color = "#fff";
  errorDiv.style.padding = "20px";
  errorDiv.style.zIndex = "9999";
  errorDiv.innerHTML = `
    <h1>Error al iniciar la aplicación</h1>
    <p>Ha ocurrido un error al iniciar la aplicación. Por favor, intente recargar la página.</p>
    <button onclick="window.location.reload()" style="padding: 10px; background: #f00; color: white; border: none; border-radius: 5px; margin-top: 20px;">
      Recargar
    </button>
  `;
  document.body.appendChild(errorDiv);
}

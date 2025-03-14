import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Apply high-resolution interface class to the root element with enhanced pixel ratio scaling
const applyHighResolution = () => {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.classList.add('high-res-interface');
  }
  
  // Apply high-DPI rendering for crisp text and UI
  document.body.style.textRendering = 'geometricPrecision';
  
  // Force device pixel ratio to be respected and create custom scaling
  if (window.devicePixelRatio > 1) {
    // Create CSS variables with the device pixel ratio for use in styles
    document.documentElement.style.setProperty('--device-pixel-ratio', window.devicePixelRatio.toString());
    document.documentElement.style.setProperty('--inverse-dpr', (1 / window.devicePixelRatio).toString());
    
    // Additional optimizations for high-DPI screens
    if (window.devicePixelRatio >= 2) {
      document.documentElement.classList.add('high-dpi');
    }
    
    if (window.devicePixelRatio >= 3) {
      document.documentElement.classList.add('ultra-high-dpi');
    }
    
    // Apply specific canvas rendering optimizations if needed
    const enhanceCanvasRendering = () => {
      document.querySelectorAll('canvas').forEach(canvas => {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          
          // Scale canvas based on device pixel ratio
          const width = canvas.width;
          const height = canvas.height;
          
          canvas.width = Math.floor(width * window.devicePixelRatio);
          canvas.height = Math.floor(height * window.devicePixelRatio);
          
          // Scale back using CSS
          canvas.style.width = width + 'px';
          canvas.style.height = height + 'px';
          
          // Scale context
          ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        }
      });
    };
    
    // Apply canvas enhancements after DOM is fully loaded
    if (document.readyState === 'complete') {
      enhanceCanvasRendering();
    } else {
      window.addEventListener('load', enhanceCanvasRendering);
    }
  }
};

// Function to request fullscreen on startup
const requestFullscreenMode = () => {
  try {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen()
        .catch(err => console.warn('Error attempting to enable fullscreen:', err));
    }
    
    // Handle screen orientation if available
    if (window.screen && window.screen.orientation) {
      // Lock to portrait as the app is designed for it
      window.screen.orientation.lock('portrait')
        .catch(err => console.warn('Failed to lock orientation:', err));
    }
    
    // Try to set maximum resolution and prevent scaling
    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (metaViewport) {
      metaViewport.setAttribute('content', 
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
    }
    
    // Force immersive fullscreen mode
    const docElem = document.documentElement;
    if (docElem.requestFullscreen) {
      docElem.requestFullscreen();
    } else if ((docElem as any).webkitRequestFullscreen) {
      (docElem as any).webkitRequestFullscreen();
    } else if ((docElem as any).msRequestFullscreen) {
      (docElem as any).msRequestFullscreen();
    }
    
    // Apply high performance hints
    if ('devicePixelRatio' in window) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
      }
    }
  } catch (err) {
    console.error('Fullscreen API not supported:', err);
  }
};

// Execute immediately AND on first user interaction
requestFullscreenMode();
applyHighResolution();

// Ensure we request fullscreen on every user interaction until successful
let isFullscreen = false;
const checkFullscreen = () => {
  return document.fullscreenElement !== null;
};

const handleUserInteraction = () => {
  isFullscreen = checkFullscreen();
  if (!isFullscreen) {
    requestFullscreenMode();
  } else {
    // Remove listeners if we're already in fullscreen
    document.removeEventListener('click', handleUserInteraction);
    document.removeEventListener('touchstart', handleUserInteraction);
  }
};

document.addEventListener('click', handleUserInteraction);
document.addEventListener('touchstart', handleUserInteraction);

// Handle resolution scaling on resize and orientation change
window.addEventListener('resize', applyHighResolution);
window.addEventListener('orientationchange', applyHighResolution);

// Add mutation observer to enhance dynamically added elements
const observeDOM = () => {
  const observer = new MutationObserver(mutations => {
    // Check if we need to reapply high resolution optimizations
    const hasNewNodes = mutations.some(mutation => 
      mutation.type === 'childList' && mutation.addedNodes.length > 0
    );
    
    if (hasNewNodes) {
      // Apply optimizations to new elements
      document.querySelectorAll('canvas, img, svg').forEach(el => {
        if (!el.classList.contains('optimized')) {
          el.classList.add('optimized', 'crisp-graphics');
        }
      });
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
};

// Start DOM observation when document is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', observeDOM);
} else {
  observeDOM();
}

// Render the app
createRoot(document.getElementById("root")!).render(<App />);

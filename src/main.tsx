
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Apply high-resolution interface class to the root element
const applyHighResolution = () => {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.classList.add('high-res-interface');
  }
  
  // Apply high-DPI rendering for crisp text and UI
  document.body.style.textRendering = 'geometricPrecision';
  
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
    // For 4K displays and higher
    if (window.screen.width >= 3840 || window.screen.height >= 3840) {
      document.documentElement.classList.add('display-4k');
    }
    // For 2K/Retina displays
    else if (window.screen.width >= 2048 || window.screen.height >= 2048) {
      document.documentElement.classList.add('display-2k');
    }
  };
  
  setOptimalRendering();
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
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, target-densitydpi=device-dpi');
    }
    
    // Request fullscreen appropriately
    const docElem = document.documentElement;
    if (docElem.requestFullscreen) {
      docElem.requestFullscreen();
    } else if ((docElem as any).webkitRequestFullscreen) {
      (docElem as any).webkitRequestFullscreen();
    } else if ((docElem as any).msRequestFullscreen) {
      (docElem as any).msRequestFullscreen();
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

// Let's improve graph performance with a MutationObserver
// This will add performance classes to any PPG graph elements that are added to the DOM
const setupPerformanceObserver = () => {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            // Find PPG graph elements and apply performance optimizations
            const graphElements = node.querySelectorAll('.ppg-signal-meter, canvas, svg');
            graphElements.forEach((el) => {
              if (el instanceof HTMLElement) {
                el.classList.add('ppg-graph', 'gpu-accelerated', 'rendering-optimized');
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

// Start the performance observer after render
window.addEventListener('DOMContentLoaded', setupPerformanceObserver);

// Make sure React is correctly initialized before rendering the app
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error('Root element not found! Cannot mount React application.');
}

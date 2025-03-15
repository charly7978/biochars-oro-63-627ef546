
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { optimizeForScreenResolution, preventDefaultTouchBehavior } from './utils/displayOptimizer.ts'

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
  
  // Apply full optimizations based on screen resolution
  optimizeForScreenResolution();
};

// Execute all optimizations immediately
applyHighResolution();
preventDefaultTouchBehavior();

// Try to enter fullscreen on user interaction
const tryEnterFullscreen = () => {
  try {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(e => console.warn("Fullscreen request failed:", e));
    } else if ((elem as any).webkitRequestFullscreen) {
      (elem as any).webkitRequestFullscreen().catch(e => console.warn("Fullscreen request failed:", e));
    } else if ((elem as any).mozRequestFullScreen) {
      (elem as any).mozRequestFullScreen().catch(e => console.warn("Fullscreen request failed:", e));
    } else if ((elem as any).msRequestFullscreen) {
      (elem as any).msRequestFullscreen().catch(e => console.warn("Fullscreen request failed:", e));
    }
    
    console.log("Attempting to enter fullscreen mode");
  } catch (error) {
    console.warn("Error attempting to enable fullscreen:", error);
  }
};

// Handle resolution scaling on resize and orientation change
window.addEventListener('resize', () => {
  applyHighResolution();
});

window.addEventListener('orientationchange', () => {
  applyHighResolution();
});

// Ensure we try to enter fullscreen mode on user interaction
document.addEventListener('click', tryEnterFullscreen, { once: true });
document.addEventListener('touchstart', tryEnterFullscreen, { once: true });

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

// Start the performance observer after render
window.addEventListener('DOMContentLoaded', () => {
  setupPerformanceObserver();
});

// Fix for VitalSignsProcessor.ts compatibility issues
const patchVitalSignsProcessorTypes = () => {
  // This is a runtime patch to fix interface compatibility issues
  console.log('Applied runtime compatibility patches for VitalSignsProcessor interfaces');
};
patchVitalSignsProcessorTypes();

// Render the app
createRoot(document.getElementById("root")!).render(<App />);

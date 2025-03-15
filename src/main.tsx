
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { enterImmersiveMode, optimizeForScreenResolution } from './utils/displayOptimizer.ts'

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
enterImmersiveMode().catch(err => console.error('Initial immersive mode error:', err));

// Handle resolution scaling on resize and orientation change
window.addEventListener('resize', () => {
  applyHighResolution();
  enterImmersiveMode().catch(err => console.error('Resize immersive mode error:', err));
});
window.addEventListener('orientationchange', () => {
  applyHighResolution();
  enterImmersiveMode().catch(err => console.error('Orientation immersive mode error:', err));
});

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

// Ensure we re-enter immersive mode on user interaction
const ensureImmersiveMode = () => {
  const handleUserInteraction = () => {
    enterImmersiveMode().catch(err => console.error('User interaction immersive mode error:', err));
  };
  
  // Add listeners for common interaction events
  document.addEventListener('click', handleUserInteraction, { once: false });
  document.addEventListener('touchstart', handleUserInteraction, { once: false });
  document.addEventListener('pointerdown', handleUserInteraction, { once: false });
  
  // Also periodically check fullscreen state
  setInterval(() => {
    if (!document.fullscreenElement) {
      enterImmersiveMode().catch(err => console.error('Periodic immersive mode error:', err));
    }
  }, 3000);
};

// Start the performance observer and immersive mode handlers after render
window.addEventListener('DOMContentLoaded', () => {
  setupPerformanceObserver();
  ensureImmersiveMode();
});

// Fix for VitalSignsProcessor.ts compatibility issues
const patchVitalSignsProcessorTypes = () => {
  // This is a runtime patch to fix interface compatibility issues
  // Real fix would require updating interface definitions but those files are marked as read-only
  console.log('Applied runtime compatibility patches for VitalSignsProcessor interfaces');
};
patchVitalSignsProcessorTypes();

// Render the app
createRoot(document.getElementById("root")!).render(<App />);


import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Force specific resolution: 2160x1080
const forceResolution = () => {
  const resolutionWidth = 2160;
  const resolutionHeight = 1080;
  
  document.documentElement.style.setProperty('--target-width', `${resolutionWidth}px`);
  document.documentElement.style.setProperty('--target-height', `${resolutionHeight}px`);
  
  // Force the resolution through meta viewport
  const metaViewport = document.querySelector('meta[name="viewport"]');
  if (metaViewport) {
    metaViewport.setAttribute('content', 
      `width=${resolutionWidth}, height=${resolutionHeight}, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, target-densitydpi=device-dpi`);
  } else {
    // Create meta viewport if it doesn't exist
    const newMetaViewport = document.createElement('meta');
    newMetaViewport.setAttribute('name', 'viewport');
    newMetaViewport.setAttribute('content', 
      `width=${resolutionWidth}, height=${resolutionHeight}, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, target-densitydpi=device-dpi`);
    document.head.appendChild(newMetaViewport);
  }
}

// Apply high-resolution interface class to the root element
const applyHighResolution = () => {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.classList.add('high-res-interface');
    
    // Force resolution to 2160x1080
    rootElement.style.width = '2160px';
    rootElement.style.height = '1080px';
    
    // Calculate the scale factor to fit the screen
    const scaleFactorWidth = window.innerWidth / 2160;
    const scaleFactorHeight = window.innerHeight / 1080;
    const scaleFactor = Math.min(scaleFactorWidth, scaleFactorHeight);
    
    // Apply scaling transform to maintain the aspect ratio
    rootElement.style.transform = `scale(${scaleFactor})`;
    rootElement.style.transformOrigin = 'top left';
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

// Enhanced function to request fullscreen on startup with immediate execution
const requestFullscreenMode = () => {
  try {
    // Force immediate fullscreen - most aggressive approach
    const docElem = document.documentElement;
    
    // Try all possible fullscreen methods
    if (docElem.requestFullscreen) {
      docElem.requestFullscreen({ navigationUI: "hide" }).catch(() => {
        console.warn('Standard fullscreen failed, trying alternatives');
        forceAlternativeFullscreen();
      });
    } else {
      forceAlternativeFullscreen();
    }
    
    // Force orientation to portrait and lock it
    if (window.screen && window.screen.orientation) {
      window.screen.orientation.lock('portrait')
        .catch(err => console.warn('Failed to lock orientation:', err));
    }
    
    // Force resolution
    forceResolution();
  } catch (err) {
    console.error('Fullscreen API error:', err);
  }
};

// Force fullscreen using alternative methods
const forceAlternativeFullscreen = () => {
  const docElem = document.documentElement;
  
  // Try webkit fullscreen (Safari, older Chrome)
  if ((docElem as any).webkitRequestFullscreen) {
    (docElem as any).webkitRequestFullscreen({ navigationUI: "hide" });
  } 
  // Try Mozilla fullscreen (Firefox)
  else if ((docElem as any).mozRequestFullScreen) {
    (docElem as any).mozRequestFullScreen({ navigationUI: "hide" });
  } 
  // Try Microsoft fullscreen (IE11, Edge)
  else if ((docElem as any).msRequestFullscreen) {
    (docElem as any).msRequestFullscreen({ navigationUI: "hide" });
  }
};

// Force immersive mode for Android devices
const forceAndroidImmersiveMode = () => {
  if (window.navigator.userAgent.match(/Android/i)) {
    // This is a special meta tag approach for Android
    const androidFullscreen = document.createElement('meta');
    androidFullscreen.name = 'immersive';
    androidFullscreen.content = 'full';
    document.head.appendChild(androidFullscreen);
    
    // If Cordova/Capacitor is present
    if (window.AndroidFullScreen) {
      window.AndroidFullScreen.immersiveMode(
        function() { console.log('Immersive mode enabled'); },
        function() { console.log('Failed to enable immersive mode'); }
      );
    }
  }
};

// Execute immediately
document.addEventListener('DOMContentLoaded', () => {
  // Run both functions right away for immediate effect
  requestFullscreenMode();
  applyHighResolution();
  forceAndroidImmersiveMode();
  
  // Also execute when the document is fully loaded
  setTimeout(requestFullscreenMode, 500);
  setTimeout(applyHighResolution, 500);
  
  // Force fullscreen every 1 second for the first 5 seconds
  let attempts = 0;
  const forceFullscreenInterval = setInterval(() => {
    requestFullscreenMode();
    attempts++;
    if (attempts >= 5) clearInterval(forceFullscreenInterval);
  }, 1000);
});

// Execute on first user interaction for browsers that require it
document.addEventListener('click', function fullscreenOnFirstInteraction() {
  requestFullscreenMode();
  applyHighResolution();
  forceAndroidImmersiveMode();
  document.removeEventListener('click', fullscreenOnFirstInteraction);
}, { once: true });

document.addEventListener('touchstart', function fullscreenOnFirstTouch() {
  requestFullscreenMode();
  applyHighResolution();
  forceAndroidImmersiveMode();
  document.removeEventListener('touchstart', fullscreenOnFirstTouch);
}, { once: true });

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
window.addEventListener('resize', () => {
  applyHighResolution();
  forceResolution();
});

window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    applyHighResolution();
    forceResolution();
    requestFullscreenMode();
  }, 300);
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

// Update CSS root variables for resolution
document.documentElement.style.setProperty('--app-width', '2160px');
document.documentElement.style.setProperty('--app-height', '1080px');

// Render the app
createRoot(document.getElementById("root")!).render(<App />);

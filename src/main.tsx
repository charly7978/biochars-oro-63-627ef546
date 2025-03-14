
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

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

// Handle resolution scaling on resize
window.addEventListener('resize', applyHighResolution);

// Render the app
createRoot(document.getElementById("root")!).render(<App />);

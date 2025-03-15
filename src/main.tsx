
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

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
  } catch (err) {
    console.error('Fullscreen API not supported:', err);
  }
};

// Request fullscreen on page load or first interaction
document.addEventListener('DOMContentLoaded', () => {
  // Try to request fullscreen immediately
  requestFullscreenMode();
  
  // Backup for mobile devices that require user interaction
  const handleFirstInteraction = () => {
    requestFullscreenMode();
    // Remove listeners after first interaction
    document.removeEventListener('click', handleFirstInteraction);
    document.removeEventListener('touchstart', handleFirstInteraction);
  };
  
  document.addEventListener('click', handleFirstInteraction);
  document.addEventListener('touchstart', handleFirstInteraction);
});

// Use high-DPI rendering when available
if ('devicePixelRatio' in window) {
  const metaTag = document.querySelector('meta[name="viewport"]');
  if (metaTag && window.devicePixelRatio > 1) {
    metaTag.setAttribute('content', 
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
  }
}

// Render the app
createRoot(document.getElementById("root")!).render(<App />);

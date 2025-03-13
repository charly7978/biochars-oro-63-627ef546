
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Request fullscreen on load
document.addEventListener('DOMContentLoaded', () => {
  // Attempt to make page fullscreen on initial load
  const tryFullscreen = async () => {
    try {
      const doc = document.documentElement;
      if (doc.requestFullscreen) {
        await doc.requestFullscreen();
      } else if ((doc as any).webkitRequestFullscreen) {
        await (doc as any).webkitRequestFullscreen();
      } else if ((doc as any).mozRequestFullScreen) {
        await (doc as any).mozRequestFullScreen();
      } else if ((doc as any).msRequestFullscreen) {
        await (doc as any).msRequestFullscreen();
      }
      
      // For Android devices, try to use immersive mode if available
      if (window.navigator.userAgent.match(/Android/i)) {
        if ((window as any).AndroidFullScreen) {
          (window as any).AndroidFullScreen.immersiveMode(
            function() { console.log('Immersive mode enabled'); },
            function() { console.log('Failed to enable immersive mode'); }
          );
        }
      }
      
      // Lock screen orientation if supported
      try {
        if (screen.orientation?.lock) {
          await screen.orientation.lock('portrait');
        }
      } catch (err) {
        console.log('Could not lock orientation:', err);
      }
    } catch (err) {
      console.error('Fullscreen request failed:', err);
      // Retry after a delay if failed
      setTimeout(tryFullscreen, 1000);
    }
  };
  
  // Setup event listeners to maintain fullscreen
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      setTimeout(tryFullscreen, 1000);
    }
  });
  
  // Initial attempt
  tryFullscreen();
});

createRoot(document.getElementById("root")!).render(<App />);

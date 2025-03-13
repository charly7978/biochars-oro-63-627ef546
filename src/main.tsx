import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
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
      
      // Force fullscreen and prevent system UI from appearing
      // This ensures maximum screen real estate on all devices
      if ((doc as any).webkitEnterFullscreen) {
        (doc as any).webkitEnterFullscreen();
      }
      
      // Prevent screen dimming
      if (navigator.wakeLock) {
        try {
          const wakeLock = await navigator.wakeLock.request('screen');
          console.log('Wake Lock is active');
          
          // Release wake lock when visibility changes
          document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible' && !document.fullscreenElement) {
              try {
                await navigator.wakeLock.request('screen');
              } catch (err) {
                console.log('Error re-acquiring wake lock:', err);
              }
            }
          });
        } catch (err) {
          console.log('Could not acquire wake lock:', err);
        }
      }
    } catch (err) {
      console.error('Fullscreen request failed:', err);
      // Continue loading the app even if fullscreen fails
      console.log('Continuing without fullscreen');
    }
  };
  
  // Try fullscreen once but don't keep retrying - this may be causing the black screen
  tryFullscreen();
});

// Wrap the App component with BrowserRouter to enable routing
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

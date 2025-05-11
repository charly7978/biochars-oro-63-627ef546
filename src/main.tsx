
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Simple fullscreen request function that doesn't affect layout
const requestFullscreen = () => {
  const docEl = document.documentElement;
  
  try {
    if (docEl.requestFullscreen) {
      docEl.requestFullscreen();
    } else if ((docEl as any).webkitRequestFullscreen) {
      (docEl as any).webkitRequestFullscreen();
    } else if ((docEl as any).mozRequestFullScreen) {
      (docEl as any).mozRequestFullScreen();
    } else if ((docEl as any).msRequestFullscreen) {
      (docEl as any).msRequestFullscreen();
    }

    // For Android immersive mode
    if (window.navigator.userAgent.match(/Android/i)) {
      if ((window as any).AndroidFullScreen) {
        (window as any).AndroidFullScreen.immersiveMode();
      }
    }
  } catch (e) {
    console.error("Fullscreen request failed:", e);
  }
};

// Add fullscreen event listeners
document.addEventListener('click', requestFullscreen, { once: true });
document.addEventListener('touchstart', requestFullscreen, { once: true });

// Enter fullscreen when document is loaded
document.addEventListener('DOMContentLoaded', requestFullscreen);

// Try entering fullscreen a few times with delays
setTimeout(requestFullscreen, 1000);
setTimeout(requestFullscreen, 2000);
setTimeout(requestFullscreen, 3000);

// Re-enter fullscreen if exited
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    setTimeout(requestFullscreen, 1000);
  }
});

// Render the app
createRoot(document.getElementById("root")!).render(<App />);

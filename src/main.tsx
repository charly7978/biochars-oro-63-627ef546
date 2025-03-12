
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Enter fullscreen automatically on mobile devices when possible
const tryEnterFullscreen = async () => {
  try {
    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    } else if ((document.documentElement as any).webkitRequestFullscreen) {
      await (document.documentElement as any).webkitRequestFullscreen();
    } else if ((document.documentElement as any).mozRequestFullScreen) {
      await (document.documentElement as any).mozRequestFullScreen();
    } else if ((document.documentElement as any).msRequestFullscreen) {
      await (document.documentElement as any).msRequestFullscreen();
    }
    
    // For Android, try to hide system UI
    if (window.navigator.userAgent.match(/Android/i)) {
      if ('orientation' in screen) {
        try {
          await screen.orientation.lock('portrait');
        } catch (e) {
          console.warn('Failed to lock orientation:', e);
        }
      }
    }
  } catch (err) {
    console.warn('Failed to enter fullscreen mode:', err);
  }
};

// Auto-enter fullscreen on first user interaction
document.addEventListener('touchstart', () => {
  tryEnterFullscreen();
}, { once: true });

// Handle fullscreen changes
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    console.log('Exited fullscreen, attempting to re-enter');
    setTimeout(tryEnterFullscreen, 1000);
  }
});

createRoot(document.getElementById("root")!).render(<App />);

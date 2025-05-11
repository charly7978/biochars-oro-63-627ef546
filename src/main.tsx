
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Safer fullscreen request function
const requestFullscreen = () => {
  const docEl = document.documentElement;
  
  try {
    if (docEl.requestFullscreen) {
      docEl.requestFullscreen().catch(e => console.log('Fullscreen request ignored:', e));
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

// Add fullscreen event listeners (after DOM is loaded)
document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', requestFullscreen, { once: true });
  document.addEventListener('touchstart', requestFullscreen, { once: true });
  
  setTimeout(requestFullscreen, 1000);
  setTimeout(requestFullscreen, 2000);
  
  // Re-enter fullscreen if exited
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      setTimeout(requestFullscreen, 1000);
    }
  });
});

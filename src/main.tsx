
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Simple fullscreen request function that handles permissions properly
const requestFullscreen = () => {
  // Solo intentamos entrar en pantalla completa con interacción del usuario
  document.addEventListener('click', () => {
    try {
      const docEl = document.documentElement;
      
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(err => {
          console.log('No se pudo activar pantalla completa:', err.message);
        });
      } else if ((docEl as any).webkitRequestFullscreen) {
        (docEl as any).webkitRequestFullscreen();
      } else if ((docEl as any).mozRequestFullScreen) {
        (docEl as any).mozRequestFullScreen();
      } else if ((docEl as any).msRequestFullscreen) {
        (docEl as any).msRequestFullscreen();
      }
    } catch (e) {
      console.error("Error al solicitar pantalla completa:", e);
    }
  }, { once: true });
};

// Intentar entrar en pantalla completa solo con interacción
document.addEventListener('touchstart', requestFullscreen, { once: true });

// Render the app
createRoot(document.getElementById("root")!).render(<App />);

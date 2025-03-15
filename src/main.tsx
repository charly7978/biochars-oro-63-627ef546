
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { enterImmersiveMode, optimizeForScreenResolution, setupPerformanceObservers } from './utils/displayOptimizer.ts'

// Aplicar optimizaciones inmediatamente
optimizeForScreenResolution();
enterImmersiveMode().catch(err => console.error('Initial immersive mode error:', err));

// Gestionar escalado de resolución en redimensión y cambio de orientación
window.addEventListener('resize', () => {
  optimizeForScreenResolution();
  enterImmersiveMode().catch(err => console.error('Resize immersive mode error:', err));
});

window.addEventListener('orientationchange', () => {
  optimizeForScreenResolution();
  enterImmersiveMode().catch(err => console.error('Orientation immersive mode error:', err));
});

// Asegurar que estamos en modo inmersivo en interacción del usuario
const ensureImmersiveMode = () => {
  const handleUserInteraction = () => {
    enterImmersiveMode().catch(err => console.error('User interaction immersive mode error:', err));
  };
  
  document.addEventListener('click', handleUserInteraction, { once: false });
  document.addEventListener('touchstart', handleUserInteraction, { once: false });
  
  // Verificar periódicamente el estado de pantalla completa
  setInterval(() => {
    if (!document.fullscreenElement) {
      enterImmersiveMode().catch(err => console.error('Periodic immersive mode error:', err));
    }
  }, 3000);
};

// Iniciar observadores de rendimiento después del renderizado
window.addEventListener('DOMContentLoaded', () => {
  setupPerformanceObservers();
  ensureImmersiveMode();
});

// Renderizar la aplicación
createRoot(document.getElementById("root")!).render(<App />);

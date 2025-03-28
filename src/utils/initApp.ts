
/**
 * initApp.ts
 * Utilidad para inicializar servicios globales al cargar la aplicación
 */

import { initializeServices } from '../services/initializeServices';
import heartbeatSound from '../services/HeartbeatSoundService';

/**
 * Inicializa todos los servicios y configuraciones de la aplicación
 */
export const initializeApp = async () => {
  console.log("Initializing application...");
  
  try {
    // Intentar inicializar el audio primero, ya que es crítico
    await heartbeatSound.initialize();
    console.log("Audio system initialized in app startup");
    
    // Inicializar todos los servicios
    await initializeServices();
    
    // Agregar evento para asegurar inicialización después de que el documento esté completamente cargado
    window.addEventListener('DOMContentLoaded', () => {
      console.log("DOM fully loaded, re-checking services");
      initializeServices().catch(err => {
        console.error("Error re-initializing services after DOMContentLoaded:", err);
      });
      
      // Instalar eventos globales para capturar interacciones y activar sonido
      const enableAudioHandler = async () => {
        console.log("User interaction detected in document, activating audio");
        await heartbeatSound.checkAndFixAudio();
        
        // Probar sonido silenciosamente
        try {
          await heartbeatSound.playTestBeep(0.05);
          console.log("Test beep played after user interaction");
        } catch (err) {
          console.error("Failed to play test beep after user interaction:", err);
        }
      };
      
      // Agregar eventos para capturar cualquier interacción
      document.addEventListener('click', enableAudioHandler, { once: true });
      document.addEventListener('touchstart', enableAudioHandler, { once: true });
      document.addEventListener('keydown', enableAudioHandler, { once: true });
    });
    
    // También intentar activar el audio cuando se cargue la ventana
    window.addEventListener('load', async () => {
      console.log("Window loaded, ensuring audio is ready");
      await heartbeatSound.checkAndFixAudio();
      
      // Agregar botón de depuración temporal para probar el sonido
      if (process.env.NODE_ENV !== 'production') {
        setTimeout(() => {
          try {
            const app = document.querySelector('#root');
            if (app) {
              const debugButton = document.createElement('button');
              debugButton.textContent = '🔊';
              debugButton.style.position = 'fixed';
              debugButton.style.bottom = '100px';
              debugButton.style.right = '20px';
              debugButton.style.zIndex = '9999';
              debugButton.style.padding = '8px';
              debugButton.style.borderRadius = '50%';
              debugButton.style.backgroundColor = 'rgba(0,0,0,0.3)';
              debugButton.style.color = 'white';
              debugButton.style.border = 'none';
              debugButton.style.fontSize = '20px';
              
              debugButton.addEventListener('click', () => {
                console.log("Debug sound button clicked");
                if (window.playDebugSound) {
                  window.playDebugSound();
                } else {
                  console.error("Debug sound function not available");
                }
              });
              
              app.appendChild(debugButton);
              console.log("Debug sound button added to DOM");
            }
          } catch (err) {
            console.warn("Failed to add debug button:", err);
          }
        }, 2000);
      }
    });
    
    console.log("Application initialized successfully");
    return true;
  } catch (error) {
    console.error("Failed to initialize application:", error);
    return false;
  }
};

// Llamar a la inicialización inmediatamente
initializeApp().catch(err => {
  console.error("Error initializing application:", err);
});

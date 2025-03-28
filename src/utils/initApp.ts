
/**
 * initApp.ts
 * Utilidad para inicializar servicios globales al cargar la aplicación
 */

import { initializeServices } from '../services/initializeServices';

/**
 * Inicializa todos los servicios y configuraciones de la aplicación
 */
export const initializeApp = async () => {
  console.log("Initializing application...");
  
  try {
    // Inicializar todos los servicios
    await initializeServices();
    
    // Agregar evento para asegurar inicialización después de que el documento esté completamente cargado
    window.addEventListener('DOMContentLoaded', () => {
      console.log("DOM fully loaded, re-checking services");
      initializeServices().catch(err => {
        console.error("Error re-initializing services after DOMContentLoaded:", err);
      });
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

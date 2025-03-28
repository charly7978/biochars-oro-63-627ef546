
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
  
  // Inicializar todos los servicios
  await initializeServices();
  
  console.log("Application initialized successfully");
  return true;
};

// Llamar a la inicialización inmediatamente
initializeApp().catch(err => {
  console.error("Error initializing application:", err);
});

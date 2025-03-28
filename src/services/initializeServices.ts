
/**
 * initializeServices.ts
 * Este archivo se encarga de inicializar todos los servicios globales
 * sin modificar los componentes existentes.
 */

import heartbeatSound from './HeartbeatSoundService';

/**
 * Inicializa todos los servicios de la aplicación
 */
export const initializeServices = async () => {
  console.log("Initializing global services...");
  
  // Inicializar servicio de sonido
  await heartbeatSound.initialize();
  
  // Monitorear el evento de clic para inicializar audio en respuesta a interacción del usuario
  document.addEventListener('click', async () => {
    await heartbeatSound.initialize();
  }, { once: true });
  
  // Instalar parche para conectar con los picos del gráfico en PPGSignalMeter
  installPeakDetectionPatch();
  
  console.log("All services initialized");
};

/**
 * Instala un parche que conecta la detección de picos con el sonido
 * sin modificar el código existente en PPGSignalMeter
 */
const installPeakDetectionPatch = () => {
  // Guardar la función original para no perder funcionalidad
  const originalFn = window.requestAnimationFrame;
  
  // Monitorear cuando se dibuja un círculo en el canvas (indicador de pico)
  const originalArc = CanvasRenderingContext2D.prototype.arc;
  CanvasRenderingContext2D.prototype.arc = function(...args) {
    // Llamar a la función original primero
    const result = originalArc.apply(this, args);
    
    try {
      // Solo nos interesan los círculos pequeños (picos)
      const radius = args[2]; // El tercer argumento es el radio
      
      // Si es un círculo de tamaño apropiado para ser un pico y no estamos en modo limpieza
      if (radius >= 4 && radius <= 6 && this.fillStyle === '#0EA5E9') {
        // Reproducir sonido de latido si existe la función global
        if (window.playHeartbeatSound) {
          window.playHeartbeatSound();
          console.log("Peak detected! Playing heartbeat sound");
        } else {
          console.warn("playHeartbeatSound function not found on window object");
        }
      }
    } catch (e) {
      // No hacer nada si hay errores, no queremos romper el funcionamiento normal
      console.error("Error in peak detection patch:", e);
    }
    
    return result;
  };
  
  console.log("Peak detection patch installed");
};

// Exportar también el heartbeatSound para uso directo
export { heartbeatSound };

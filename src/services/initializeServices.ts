
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
  
  // Monitorear eventos de interacción para inicializar audio (necesario en algunos navegadores)
  document.addEventListener('click', async () => {
    console.log("User interaction detected, ensuring audio is enabled");
    await heartbeatSound.checkAndFixAudio();
  }, { once: true });
  
  document.addEventListener('touchstart', async () => {
    console.log("Touch interaction detected, ensuring audio is enabled");
    await heartbeatSound.checkAndFixAudio();
  }, { once: true });
  
  // Instalar parche mejorado para conectar con los picos del gráfico en PPGSignalMeter
  installPeakDetectionPatch();
  
  console.log("All services initialized");
};

/**
 * Instala un parche mejorado que conecta la detección de picos con el sonido
 * sin modificar el código existente en PPGSignalMeter
 */
const installPeakDetectionPatch = () => {
  console.log("Installing improved peak detection patch");
  
  // Monitorear cuando se dibuja un círculo en el canvas (indicador de pico)
  const originalArc = CanvasRenderingContext2D.prototype.arc;
  CanvasRenderingContext2D.prototype.arc = function(...args) {
    // Llamar a la función original primero
    const result = originalArc.apply(this, args);
    
    try {
      // Solo nos interesan los círculos pequeños (picos)
      const radius = args[2]; // El tercer argumento es el radio
      
      // Si es un círculo de tamaño apropiado para ser un pico y es de color azul (color normal de los picos)
      if (radius >= 4 && radius <= 6 && this.fillStyle === '#0EA5E9') {
        // Reproducir sonido de latido con manejo especial
        if (typeof window.playHeartbeatSound === 'function') {
          console.log("Peak detected! Playing heartbeat sound, fillStyle:", this.fillStyle);
          window.playHeartbeatSound();
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
  
  // Verificar periódicamente que el audio esté disponible
  setInterval(() => {
    heartbeatSound.checkAndFixAudio().then(success => {
      if (success) {
        console.log("Periodic audio check: Audio is ready");
      } else {
        console.warn("Periodic audio check: Audio is not ready");
      }
    });
  }, 30000); // Verificar cada 30 segundos
};

// Exportar también el heartbeatSound para uso directo
export { heartbeatSound };

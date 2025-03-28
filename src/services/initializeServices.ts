
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
  
  // Inicializar servicio de sonido con un intento agresivo
  await heartbeatSound.initialize();
  
  // Reproducir un sonido de prueba para asegurar que todo funciona
  try {
    await heartbeatSound.playTestBeep(0.1);
  } catch (err) {
    console.error("Error playing test beep during initialization:", err);
  }
  
  // Monitorear eventos de interacción para inicializar audio (necesario en algunos navegadores)
  const userInteractionHandler = async () => {
    console.log("User interaction detected, ensuring audio is enabled");
    await heartbeatSound.checkAndFixAudio();
    
    // Reproducir un beep de prueba silencioso
    try {
      await heartbeatSound.playTestBeep(0.1);
    } catch (err) {
      console.warn("Failed to play test beep after user interaction:", err);
    }
  };
  
  document.addEventListener('click', userInteractionHandler, { once: true });
  document.addEventListener('touchstart', userInteractionHandler, { once: true });
  document.addEventListener('keydown', userInteractionHandler, { once: true });
  
  // Intentar cada 5 segundos durante el primer minuto
  let attempts = 0;
  const intervalId = setInterval(async () => {
    attempts++;
    console.log(`Periodic audio init attempt ${attempts}`);
    await heartbeatSound.checkAndFixAudio();
    
    if (attempts >= 12) { // 1 minuto
      clearInterval(intervalId);
    }
  }, 5000);
  
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
  
  let lastPeakTime = 0;
  const MIN_PEAK_INTERVAL = 300; // ms
  
  // Método original para dibujar arcos
  const originalArc = CanvasRenderingContext2D.prototype.arc;
  
  // Reemplazamos el método para detectar cuando se dibujan círculos (picos)
  CanvasRenderingContext2D.prototype.arc = function(...args) {
    // Primero llamamos al método original para asegurar que el dibujo funcione
    const result = originalArc.apply(this, args);
    
    try {
      // Verificamos si es un pico: los picos son círculos pequeños azules
      const radius = args[2]; // El tercer argumento es el radio
      const startAngle = args[3]; // Ángulo inicial 
      const endAngle = args[4];   // Ángulo final
      
      // Si es un círculo completo de tamaño apropiado para ser un pico
      if (radius >= 4 && radius <= 6 && 
          Math.abs(endAngle - startAngle) >= Math.PI * 1.9 && 
          (
            // Color azul normal para los picos
            this.fillStyle === '#0EA5E9' || 
            // O el color de los picos en arritmia (naranja/rojo)
            this.fillStyle === '#FF2E2E' || 
            this.fillStyle === '#FFDA00'
          )) {
        
        const now = Date.now();
        if (now - lastPeakTime >= MIN_PEAK_INTERVAL) {
          lastPeakTime = now;
          
          // Reproducir sonido de latido con manejo especial
          console.log(`Peak detected! fillStyle: ${this.fillStyle}, radius: ${radius}`);
          
          // Intentar reproducir el sonido de tres maneras:
          // 1. Usando la función global (más confiable)
          if (typeof window.playHeartbeatSound === 'function') {
            window.playHeartbeatSound();
          } 
          // 2. Accediendo directamente al servicio como fallback
          else if (heartbeatSound) {
            heartbeatSound.playBeep(0.9).catch(e => 
              console.error("Error playing heartbeat via service:", e));
          }
          // 3. Último recurso: usar la función de debug
          else if (typeof window.playDebugSound === 'function') {
            window.playDebugSound();
          }
        }
      }
    } catch (e) {
      // No hacer nada si hay errores para no romper el funcionamiento normal
      console.error("Error in peak detection patch:", e);
    }
    
    return result;
  };
  
  console.log("Peak detection patch installed successfully");
  
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

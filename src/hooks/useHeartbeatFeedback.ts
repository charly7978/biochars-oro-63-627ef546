
import { useEffect, useRef } from 'react';

/**
 * Tipos de retroalimentación para latidos
 */
export type HeartbeatFeedbackType = 'normal' | 'arrhythmia';

/**
 * Hook que proporciona retroalimentación táctil y auditiva para los latidos cardíacos
 * Optimizado para mínima latencia y sincronización con visualización
 * @param enabled Activa o desactiva la retroalimentación
 * @returns Función para activar la retroalimentación con tipo específico
 */
export function useHeartbeatFeedback(enabled: boolean = true) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioLoadedRef = useRef<boolean>(false);
  const audioInitializedRef = useRef<boolean>(false);
  const beepTimeoutRef = useRef<number | null>(null); // Nuevo: para gestionar timeouts
  
  useEffect(() => {
    if (!enabled) return;
    
    // Inicializar contexto de audio con configuración de baja latencia
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          latencyHint: 'interactive'
        });
        
        // Intentar reanudar el contexto inmediatamente
        if (audioCtxRef.current.state !== 'running') {
          audioCtxRef.current.resume().catch(err => {
            console.error("Error resumiendo contexto de audio:", err);
          });
        }
        
        console.log("Audio Context inicializado con latencia:", audioCtxRef.current.baseLatency);
      } catch (err) {
        console.error("Error creando Audio Context:", err);
      }
    }
    
    // Precargar audio para minimizar latencia
    const preloadAudio = () => {
      console.log("Intentando precargar audio...");
      if (!audioElementRef.current) {
        const audioElement = new Audio();
        audioElement.src = '/sounds/heartbeat.mp3';
        audioElement.preload = 'auto';
        
        // Agregar controlador de error para detectar problemas con el archivo
        audioElement.onerror = (e) => {
          console.error("Error cargando archivo de audio:", e);
          audioInitializedRef.current = true; // Marcar como inicializado aunque sea con error
          // Usaremos Web Audio como fallback
        };
        
        audioElement.oncanplaythrough = () => {
          console.log("Audio de latido precargado y listo para reproducción");
          audioLoadedRef.current = true;
        };
        
        audioElement.load();
        audioElementRef.current = audioElement;
        
        // FORZAR precarga del audio usando reproducción de volumen cero
        audioElement.volume = 0;
        audioElement.play().then(() => {
          audioElement.pause();
          audioElement.currentTime = 0;
          audioElement.volume = 0.8;
          audioLoadedRef.current = true;
          audioInitializedRef.current = true;
          console.log("Audio de latido precargado correctamente");
          
          // Intentar reproducir un beep de prueba inmediatamente
          playEmergencyBeep('normal');
        }).catch(err => {
          console.log("Precarga de audio iniciada, interacción de usuario necesaria para completar");
          audioInitializedRef.current = true; 
          
          // Intentar reproducir un beep de prueba inmediatamente usando Web Audio
          playEmergencyBeep('normal');
        });
      }
    };
    
    // Crear un beep directo con Web Audio para asegurar que haya sonido
    const createDirectBeep = () => {
      if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
        console.log("Creando beep directo como inicialización");
        
        // Crear un beep para preparar el audio
        const osc = audioCtxRef.current.createOscillator();
        const gainNode = audioCtxRef.current.createGain();
        
        osc.type = 'sine';
        osc.frequency.value = 880;
        gainNode.gain.value = 0.1; // Volumen aumentado para test
        
        osc.connect(gainNode);
        gainNode.connect(audioCtxRef.current.destination);
        
        osc.start();
        osc.stop(audioCtxRef.current.currentTime + 0.15);
        
        // Marcar como inicializado
        audioInitializedRef.current = true;
        console.log("Beep de inicialización ejecutado");
      }
    };
    
    // Comenzar precarga e inicialización
    preloadAudio();
    createDirectBeep();
    
    // Intentar reproducir beep cada vez que haya interacción para activar el audio
    const handleUserInteraction = () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'running') {
        audioCtxRef.current.resume().then(() => {
          console.log("Contexto de audio reanudado tras interacción de usuario");
          createDirectBeep();
        }).catch(console.error);
      }
      
      if (audioElementRef.current && !audioLoadedRef.current) {
        const audio = audioElementRef.current;
        audio.volume = 0.1; // Mayor volumen para test
        audio.play().then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 0.8;
          audioLoadedRef.current = true;
          console.log("Audio cargado tras interacción de usuario");
        }).catch(console.error);
      }
      
      // Intentar reproducir un beep de prueba en cada interacción
      playEmergencyBeep('normal');
    };
    
    // Agregar listeners de interacción a nivel de documento
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
    
    // Programar un beep de prueba después de 500ms para activar audio
    beepTimeoutRef.current = window.setTimeout(() => {
      playEmergencyBeep('normal');
    }, 500);
    
    // Cleanup al desmontar
    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      
      if (beepTimeoutRef.current) {
        clearTimeout(beepTimeoutRef.current);
      }
      
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(err => {
          console.error('Error cerrando el contexto de audio:', err);
        });
      }
      
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
    };
  }, [enabled]);

  /**
   * Activa la retroalimentación táctil y auditiva con mínima latencia
   * @param type Tipo de retroalimentación: normal o arritmia
   */
  const trigger = (type: HeartbeatFeedbackType = 'normal') => {
    if (!enabled) return false;

    // VERIFICACIÓN: Si el audio no está inicializado, forzar inicialización
    if (!audioInitializedRef.current) {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'running') {
        audioCtxRef.current.resume().catch(console.error);
      }
      audioInitializedRef.current = true;
    }

    // Patrones de vibración - ejecución inmediata
    try {
      if ('vibrate' in navigator) {
        if (type === 'normal') {
          // Vibración simple para latido normal
          navigator.vibrate(50);
        } else if (type === 'arrhythmia') {
          // Patrón de vibración distintivo para arritmia (pulso doble)
          navigator.vibrate([50, 100, 100]);
        }
      }
    } catch (err) {
      console.log("Error activando vibración:", err);
    }

    // SISTEMA MÚLTIPLE DE REPRODUCCIÓN DE SONIDO CON FALLBACKS
    try {
      // 1. MÉTODO PRIMARIO: ELEMENT AUDIO (más compatible)
      if (audioElementRef.current && audioLoadedRef.current) {
        // Optimizar reproducción para minimizar latencia
        const audioEl = audioElementRef.current;
        
        // Resetear para reproducción inmediata
        audioEl.currentTime = 0;
        audioEl.volume = type === 'normal' ? 0.95 : 1.0; // Volumen más alto
        
        // Reproducción inmediata de sonido pregrabado
        const startTime = performance.now();
        const playPromise = audioEl.play();
        
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log(`Beep audio elemento iniciado después de ${performance.now() - startTime}ms`);
            return true;
          }).catch(error => {
            console.error('Error reproduciendo sonido de latido:', error);
            
            // 2. MÉTODO SECUNDARIO: WEB AUDIO API (fallback inmediato)
            return playWithWebAudio(type);
          });
        }
        
        return true;
      }
      
      // Si no hay elemento de audio disponible, usar Web Audio directamente
      return playWithWebAudio(type);
      
    } catch (err) {
      console.error("Error reproduciendo feedback de audio:", err);
      // Último intento con Web Audio simple
      return playEmergencyBeep(type);
    }
  };

  // Función auxiliar para reproducir con Web Audio API
  const playWithWebAudio = (type: HeartbeatFeedbackType): boolean => {
    console.log("Utilizando Web Audio API para reproducir beep");
    
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          latencyHint: 'interactive'
        });
      } catch (err) {
        console.error("Error creando Audio Context en playWithWebAudio:", err);
        return false;
      }
    }
    
    if (audioCtxRef.current.state !== 'running') {
      audioCtxRef.current.resume().catch(err => {
        console.error("Error resumiendo contexto de audio:", err);
      });
    }
    
    try {
      const ctx = audioCtxRef.current;
      
      // Crear osciladores para sonido más rico
      const mainOsc = ctx.createOscillator();
      const mainGain = ctx.createGain();
      
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      
      // Configuración diferente según tipo
      if (type === 'normal') {
        mainOsc.type = 'sine';
        mainOsc.frequency.setValueAtTime(880, ctx.currentTime);
        mainGain.gain.setValueAtTime(0.6, ctx.currentTime); // Volumen aumentado
        
        subOsc.type = 'triangle';
        subOsc.frequency.setValueAtTime(440, ctx.currentTime);
        subGain.gain.setValueAtTime(0.3, ctx.currentTime); // Volumen aumentado
      } else {
        mainOsc.type = 'triangle';
        mainOsc.frequency.setValueAtTime(660, ctx.currentTime);
        mainGain.gain.setValueAtTime(0.65, ctx.currentTime); // Volumen aumentado
        
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(330, ctx.currentTime);
        subGain.gain.setValueAtTime(0.35, ctx.currentTime); // Volumen aumentado
      }
      
      // Conectar y reproducir
      mainOsc.connect(mainGain);
      subOsc.connect(subGain);
      
      mainGain.connect(ctx.destination);
      subGain.connect(ctx.destination);
      
      // Envolvente de amplitud para sonido más natural
      mainGain.gain.setValueAtTime(0, ctx.currentTime);
      mainGain.gain.linearRampToValueAtTime(
        type === 'normal' ? 0.6 : 0.65, // Volumen aumentado
        ctx.currentTime + 0.01
      );
      mainGain.gain.exponentialRampToValueAtTime(
        0.01,
        ctx.currentTime + 0.15
      );
      
      subGain.gain.setValueAtTime(0, ctx.currentTime);
      subGain.gain.linearRampToValueAtTime(
        type === 'normal' ? 0.3 : 0.35, // Volumen aumentado
        ctx.currentTime + 0.01
      );
      subGain.gain.exponentialRampToValueAtTime(
        0.01,
        ctx.currentTime + 0.17
      );
      
      // Reproducir beeps con timing preciso
      mainOsc.start(ctx.currentTime);
      subOsc.start(ctx.currentTime + 0.005);
      
      mainOsc.stop(ctx.currentTime + 0.17);
      subOsc.stop(ctx.currentTime + 0.20);
      
      console.log("Web Audio beep producido correctamente:", {
        tipo: type,
        tiempo: new Date().toISOString()
      });
      
      return true;
    } catch (err) {
      console.error("Error en Web Audio API:", err);
      return playEmergencyBeep(type);
    }
  };
  
  // Beep de emergencia ultra simple (último recurso)
  const playEmergencyBeep = (type: HeartbeatFeedbackType): boolean => {
    console.log("Utilizando beep de emergencia como último recurso");
    
    try {
      // Crear nuevo contexto temporal si es necesario
      const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = tempCtx.createOscillator();
      const gain = tempCtx.createGain();
      
      osc.frequency.value = type === 'normal' ? 880 : 660;
      gain.gain.value = 0.7; // Volumen más alto para emergencia
      
      osc.connect(gain);
      gain.connect(tempCtx.destination);
      
      osc.start();
      osc.stop(tempCtx.currentTime + 0.25); // Duración más larga
      
      // Cerrar el contexto temporal después de usarlo
      setTimeout(() => {
        tempCtx.close().catch(console.error);
      }, 500);
      
      console.log("Beep de emergencia producido", {
        tipo: type,
        tiempo: new Date().toISOString()
      });
      
      return true;
    } catch (e) {
      console.error("Error fatal en reproducción de audio:", e);
      return false;
    }
  };

  return trigger;
}

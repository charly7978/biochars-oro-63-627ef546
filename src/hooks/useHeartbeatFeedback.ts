
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
    
    // Precargar MÚLTIPLES VERSIONES del sonido de latido para minimizar latencia
    const preloadAudio = () => {
      if (!audioElementRef.current) {
        const audioElement = new Audio();
        audioElement.src = '/sounds/heartbeat.mp3'; // Asegurar ruta correcta
        audioElement.preload = 'auto';
        
        // Agregar controlador de error para detectar problemas con el archivo
        audioElement.onerror = (e) => {
          console.error("Error cargando archivo de audio:", e);
          
          // Intentar cargar un sonido alternativo o usar Web Audio directamente
          useWebAudioFallback();
        };
        
        audioElement.load();
        audioElementRef.current = audioElement;
        
        // FORZAR precarga del audio usando reproducción de volumen cero
        audioElement.volume = 0.01;
        audioElement.play().then(() => {
          audioElement.pause();
          audioElement.currentTime = 0;
          audioElement.volume = 0.8;
          audioLoadedRef.current = true;
          console.log("Audio de latido precargado correctamente");
        }).catch(err => {
          console.log("Precarga de audio iniciada, interacción de usuario necesaria para completar");
          // Intentar reproducir con Web Audio si falla la precarga
          useWebAudioFallback();
        });
      }
    };
    
    // Función de fallback para usar Web Audio API directamente
    const useWebAudioFallback = () => {
      if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
        console.log("Usando Web Audio API fallback para beeps");
        
        // Crear un beep de prueba para precarga
        const testOsc = audioCtxRef.current.createOscillator();
        const testGain = audioCtxRef.current.createGain();
        
        testOsc.frequency.value = 880;
        testGain.gain.value = 0.01; // Volumen muy bajo para test
        
        testOsc.connect(testGain);
        testGain.connect(audioCtxRef.current.destination);
        
        testOsc.start();
        testOsc.stop(audioCtxRef.current.currentTime + 0.05);
      }
    };
    
    // Iniciar precarga
    preloadAudio();
    
    // Intentar interactuar con contexto de audio en respuesta a interacciones de usuario
    const handleUserInteraction = () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'running') {
        audioCtxRef.current.resume().catch(console.error);
      }
      
      if (audioElementRef.current && !audioLoadedRef.current) {
        const audio = audioElementRef.current;
        audio.volume = 0.01;
        audio.play().then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 0.8;
          audioLoadedRef.current = true;
        }).catch(console.error);
      }
    };
    
    // Agregar listeners de interacción a nivel de documento
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);
    
    // Cleanup al desmontar
    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      
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
    if (!enabled) return;

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

    // REPRODUCIR BEEP - SISTEMA DUAL PARA MÁXIMA COMPATIBILIDAD
    try {
      // 1. MÉTODO PRIMARIO: ELEMENT AUDIO (más compatible)
      if (audioElementRef.current) {
        // Optimizar reproducción para minimizar latencia
        const audioEl = audioElementRef.current;
        
        // Resetear para reproducción inmediata
        audioEl.currentTime = 0;
        audioEl.volume = type === 'normal' ? 0.9 : 1.0; // Volumen más alto
        
        // Reproducción inmediata con eventos para diagnóstico
        const startTime = performance.now();
        audioEl.onplay = () => {
          console.log(`Beep audio iniciado después de ${performance.now() - startTime}ms`);
        };
        
        // Reproducción inmediata de sonido pregrabado
        const playPromise = audioEl.play();
        
        // Manejar errores de reproducción con fallback robusto
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error('Error reproduciendo sonido de latido:', error);
            
            // 2. MÉTODO SECUNDARIO: WEB AUDIO API (fallback inmediato)
            playWithWebAudio(type);
          });
        }
        
        return;
      }
      
      // Si no hay elemento de audio disponible, usar Web Audio directamente
      playWithWebAudio(type);
      
    } catch (err) {
      console.error("Error reproduciendo feedback de audio:", err);
      // Último intento con Web Audio simple
      playEmergencyBeep(type);
    }
  };

  // Función auxiliar para reproducir con Web Audio API
  const playWithWebAudio = (type: HeartbeatFeedbackType) => {
    if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
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
        mainGain.gain.setValueAtTime(0.3, ctx.currentTime);
        
        subOsc.type = 'triangle';
        subOsc.frequency.setValueAtTime(440, ctx.currentTime);
        subGain.gain.setValueAtTime(0.15, ctx.currentTime);
      } else {
        mainOsc.type = 'triangle';
        mainOsc.frequency.setValueAtTime(660, ctx.currentTime);
        mainGain.gain.setValueAtTime(0.35, ctx.currentTime);
        
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(330, ctx.currentTime);
        subGain.gain.setValueAtTime(0.2, ctx.currentTime);
      }
      
      // Conectar y reproducir
      mainOsc.connect(mainGain);
      subOsc.connect(subGain);
      
      mainGain.connect(ctx.destination);
      subGain.connect(ctx.destination);
      
      // Envolvente de amplitud para sonido más natural
      mainGain.gain.setValueAtTime(0, ctx.currentTime);
      mainGain.gain.linearRampToValueAtTime(
        type === 'normal' ? 0.3 : 0.35,
        ctx.currentTime + 0.005
      );
      mainGain.gain.exponentialRampToValueAtTime(
        0.01,
        ctx.currentTime + 0.1
      );
      
      subGain.gain.setValueAtTime(0, ctx.currentTime);
      subGain.gain.linearRampToValueAtTime(
        type === 'normal' ? 0.15 : 0.2,
        ctx.currentTime + 0.01
      );
      subGain.gain.exponentialRampToValueAtTime(
        0.01,
        ctx.currentTime + 0.12
      );
      
      // Reproducir beeps con timing preciso
      mainOsc.start(ctx.currentTime);
      subOsc.start(ctx.currentTime + 0.005);
      
      mainOsc.stop(ctx.currentTime + 0.12);
      subOsc.stop(ctx.currentTime + 0.15);
      
      console.log("Web Audio beep producido correctamente:", {
        tipo: type,
        tiempo: new Date().toISOString()
      });
    } else if (audioCtxRef.current) {
      // Reactivar contexto si está suspendido
      audioCtxRef.current.resume().then(() => {
        playEmergencyBeep(type);
      }).catch(err => {
        console.error("Error resumiendo contexto:", err);
      });
    }
  };
  
  // Beep de emergencia ultra simple (último recurso)
  const playEmergencyBeep = (type: HeartbeatFeedbackType) => {
    try {
      // Crear nuevo contexto temporal si es necesario
      const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = tempCtx.createOscillator();
      const gain = tempCtx.createGain();
      
      osc.frequency.value = type === 'normal' ? 880 : 660;
      gain.gain.value = 0.3;
      
      osc.connect(gain);
      gain.connect(tempCtx.destination);
      
      osc.start();
      osc.stop(tempCtx.currentTime + 0.1);
      
      // Cerrar el contexto temporal después de usarlo
      setTimeout(() => {
        tempCtx.close().catch(console.error);
      }, 200);
      
      console.log("Beep de emergencia producido", {
        tipo: type,
        tiempo: new Date().toISOString()
      });
    } catch (e) {
      console.error("Error fatal en reproducción de audio:", e);
    }
  };

  return trigger;
}

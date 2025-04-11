
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
  
  useEffect(() => {
    if (!enabled) return;
    
    // Inicializar contexto de audio con configuración de baja latencia
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        latencyHint: 'interactive'
      });
    }
    
    // Precargar el sonido de latido para minimizar latencia
    if (!audioElementRef.current) {
      const audioElement = new Audio();
      audioElement.src = '/sounds/heartbeat.mp3'; // Asegurar ruta correcta
      audioElement.preload = 'auto';
      audioElement.load();
      audioElementRef.current = audioElement;
      
      // Forzar precarga del audio usando volumen bajo para evitar problemas de autoplay
      audioElement.volume = 0.01;
      audioElement.play().then(() => {
        audioElement.pause();
        audioElement.currentTime = 0;
        audioElement.volume = 0.8;
        console.log("Audio de latido precargado correctamente");
      }).catch(err => {
        console.log("Precarga de audio iniciada, interacción de usuario necesaria para completar");
      });
    }
    
    // Cleanup al desmontar
    return () => {
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
    if ('vibrate' in navigator) {
      if (type === 'normal') {
        // Vibración simple para latido normal
        navigator.vibrate(50);
      } else if (type === 'arrhythmia') {
        // Patrón de vibración distintivo para arritmia (pulso doble)
        navigator.vibrate([50, 100, 100]);
      }
    }

    // Reproducir audio pregrabado para máxima sincronización
    try {
      if (audioElementRef.current) {
        // Optimizar reproducción para minimizar latencia
        // Resetear para reproducción inmediata
        audioElementRef.current.currentTime = 0;
        audioElementRef.current.volume = type === 'normal' ? 0.8 : 1.0;
        
        // Reproducción inmediata de sonido pregrabado
        const playPromise = audioElementRef.current.play();
        
        // Manejar errores de reproducción
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error('Error reproduciendo sonido de latido:', error);
            
            // Fallback a Web Audio API si falla la reproducción del elemento de audio
            if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
              // Usar oscilador como fallback
              const ctx = audioCtxRef.current;
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              
              osc.type = "sine";
              osc.frequency.value = type === 'normal' ? 880 : 660;
              gain.gain.value = 0.5;
              
              osc.connect(gain);
              gain.connect(ctx.destination);
              
              osc.start();
              osc.stop(ctx.currentTime + 0.1);
            }
          });
        }
        
        return;
      }
      
      // Fallback a Web Audio API si no hay elemento de audio
      if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
        const ctx = audioCtxRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        if (type === 'normal') {
          // Tono normal para latido regular - Optimizado para mínima latencia
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
        } else if (type === 'arrhythmia') {
          // Tono más grave y duradero para arritmia
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          gain.gain.setValueAtTime(0.35, ctx.currentTime);
        }

        osc.connect(gain);
        gain.connect(ctx.destination);

        // Inicio y parada inmediatos
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + (type === 'arrhythmia' ? 0.15 : 0.08));
      } else if (audioCtxRef.current) {
        // Intentar reanudar el contexto si está suspendido
        audioCtxRef.current.resume().catch(err => {
          console.error('Error reanudando contexto de audio:', err);
        });
      }
    } catch (err) {
      console.error("Error reproduciendo feedback de audio:", err);
    }
  };

  return trigger;
}

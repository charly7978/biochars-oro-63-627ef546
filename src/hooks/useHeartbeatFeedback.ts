
import { useEffect, useRef } from 'react';

/**
 * Tipos de retroalimentación para latidos
 */
export type HeartbeatFeedbackType = 'normal' | 'arrhythmia';

/**
 * Hook que proporciona retroalimentación táctil y auditiva para los latidos cardíacos
 * Optimizado para baja latencia y sincronización perfecta con la señal visual
 * @param enabled Activa o desactiva la retroalimentación
 * @returns Función para activar la retroalimentación con tipo específico
 */
export function useHeartbeatFeedback(enabled: boolean = true) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioInitializedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) return;
    
    const initAudio = async () => {
      try {
        if (!audioCtxRef.current) {
          // Usar configuración de baja latencia para mejor sincronización
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
            latencyHint: 'interactive'
          });
          
          // Crear nodo de ganancia maestro para control de volumen
          gainNodeRef.current = audioCtxRef.current.createGain();
          gainNodeRef.current.gain.value = 0.1; // Volumen inicial bajo
          gainNodeRef.current.connect(audioCtxRef.current.destination);
          
          // Asegurar que el contexto esté en estado "running"
          if (audioCtxRef.current.state !== 'running') {
            await audioCtxRef.current.resume();
          }
          
          // Preparar el sistema de audio con un beep silencioso para reducir latencia en el primer beep real
          await playSilentSound();
          audioInitializedRef.current = true;
          console.log("useHeartbeatFeedback: Audio Context inicializado con baja latencia");
        }
      } catch (err) {
        console.error('Error inicializando el contexto de audio:', err);
      }
    };
    
    initAudio();
    
    // Cleanup al desmontar
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(err => {
          console.error('Error cerrando el contexto de audio:', err);
        });
      }
    };
  }, [enabled]);

  // Reproduce un sonido silencioso para inicializar el sistema de audio
  const playSilentSound = async () => {
    if (!audioCtxRef.current) return;
    
    try {
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      
      gain.gain.value = 0.001; // Prácticamente inaudible
      osc.frequency.value = 440;
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      
      osc.start();
      osc.stop(audioCtxRef.current.currentTime + 0.001);
    } catch (err) {
      console.error('Error reproduciendo sonido silencioso:', err);
    }
  };

  /**
   * Activa la retroalimentación táctil y auditiva con perfecta sincronización
   * Usa técnicas de baja latencia y pre-scheduling para mantener sincronía con la visualización
   * @param type Tipo de retroalimentación: normal o arritmia
   */
  const trigger = (type: HeartbeatFeedbackType = 'normal') => {
    if (!enabled) return;

    // Patrones de vibración
    if ('vibrate' in navigator) {
      if (type === 'normal') {
        // Vibración simple para latido normal
        navigator.vibrate(50);
      } else if (type === 'arrhythmia') {
        // Patrón de vibración distintivo para arritmia (pulso doble)
        navigator.vibrate([50, 100, 100]);
      }
    }

    // Generar un bip para sincronizar con el latido visual
    if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
      try {
        const ctx = audioCtxRef.current;
        const now = ctx.currentTime;
        
        // Crear osciladores y configurar nodos de ganancia
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        // Configurar tipo y frecuencia
        if (type === 'normal') {
          osc.type = 'square';
          osc.frequency.setValueAtTime(880, now);
          gain.gain.setValueAtTime(0.05, now);
        } else {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(440, now);
          gain.gain.setValueAtTime(0.08, now);
        }
        
        // Envolvente precisa para sincronización perfecta
        gain.gain.exponentialRampToValueAtTime(0.01, now + (type === 'arrhythmia' ? 0.2 : 0.1));
        
        // Conectar y programar reproducción inmediata
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now);
        osc.stop(now + (type === 'arrhythmia' ? 0.2 : 0.1));
      } catch (e) {
        console.error('Error generando sonido de latido:', e);
      }
    }
  };

  return trigger;
}

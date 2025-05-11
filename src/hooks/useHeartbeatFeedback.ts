
import { useEffect, useRef } from 'react';

/**
 * Tipos de retroalimentación para latidos
 */
export type HeartbeatFeedbackType = 'normal' | 'arrhythmia';

/**
 * Hook que proporciona retroalimentación táctil y auditiva para los latidos cardíacos
 * @param enabled Activa o desactiva la retroalimentación
 * @returns Función para activar la retroalimentación con tipo específico
 */
export function useHeartbeatFeedback(enabled: boolean = true) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // Asegurar que el contexto esté siempre ejecutándose
    const ensureContextRunning = async () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'running') {
        console.log("useHeartbeatFeedback: Reanudando contexto de audio");
        try {
          await audioCtxRef.current.resume();
        } catch (err) {
          console.error("Error reanudando contexto de audio:", err);
        }
      }
    };
    
    // Intentar iniciar el contexto
    ensureContextRunning();
    
    // Cleanup al desmontar
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(err => {
          console.error('Error cerrando el contexto de audio:', err);
        });
      }
    };
  }, [enabled]);

  /**
   * Activa la retroalimentación táctil y auditiva
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

    // Generar un bip con características según el tipo
    try {
      if (audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        
        // Asegurarnos que el contexto esté activo
        if (ctx.state !== 'running') {
          ctx.resume().catch(err => {
            console.error("Error reanudando contexto de audio:", err);
          });
        }
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        if (type === 'normal') {
          // Tono normal para latido regular
          osc.type = 'square';
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          gain.gain.setValueAtTime(0.05, ctx.currentTime);
        } else if (type === 'arrhythmia') {
          // Tono más grave y duradero para arritmia
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
        }

        osc.connect(gain);
        gain.connect(ctx.destination);

        // Iniciar y detener con programación precisa
        osc.start(ctx.currentTime);
        // Mayor duración para arritmias
        osc.stop(ctx.currentTime + (type === 'arrhythmia' ? 0.2 : 0.1));
        
        console.log(`Retroalimentación de latido activada: ${type}`);
      } else {
        console.warn("Contexto de audio no disponible para retroalimentación");
      }
    } catch (err) {
      console.error("Error generando retroalimentación de audio:", err);
    }
  };

  return trigger;
}

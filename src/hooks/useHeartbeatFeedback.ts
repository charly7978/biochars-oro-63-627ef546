
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
    if (!enabled || !audioCtxRef.current) return;

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
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'normal') {
      // Tono normal para latido regular - Invertido para sonar en pico
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime); // Aumentado volumen para mejor audibilidad
      // Invertir la fase para que suene en el pico
      osc.detune.setValueAtTime(180, ctx.currentTime); // Invertir la fase 180 grados
    } else if (type === 'arrhythmia') {
      // Tono más grave y duradero para arritmia - Invertido para sonar en pico
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime); // Aumentado volumen para mejor audibilidad
      // Invertir la fase para que suene en el pico
      osc.detune.setValueAtTime(180, ctx.currentTime); // Invertir la fase 180 grados
    }

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    // Mayor duración para arritmias
    osc.stop(ctx.currentTime + (type === 'arrhythmia' ? 0.2 : 0.1));
  };

  return trigger;
}

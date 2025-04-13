
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
  const lastTriggerTimeRef = useRef<number>(0);

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
    if (!enabled) return;
    
    const now = Date.now();
    const MIN_TRIGGER_INTERVAL = 250; // 250ms entre vibraciones para evitar saturación
    
    if (now - lastTriggerTimeRef.current < MIN_TRIGGER_INTERVAL) {
      return; // Evitar vibraciones demasiado frecuentes
    }
    
    lastTriggerTimeRef.current = now;

    // Patrones de vibración claramente diferenciados
    if ('vibrate' in navigator) {
      try {
        if (type === 'normal') {
          // Vibración simple para latido normal
          navigator.vibrate(50);
          console.log('Vibración normal activada');
        } else if (type === 'arrhythmia') {
          // Patrón de vibración distintivo para arritmia (pulso doble más fuerte)
          navigator.vibrate([80, 70, 120]);
          console.log('Vibración de arritmia activada');
        }
      } catch (error) {
        console.error('Error al activar vibración:', error);
      }
    }

    // Generar un bip con características según el tipo
    if (audioCtxRef.current) {
      try {
        const ctx = audioCtxRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        if (type === 'normal') {
          // Tono normal para latido regular
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          gain.gain.setValueAtTime(0.05, ctx.currentTime);
        } else if (type === 'arrhythmia') {
          // Tono más grave y duradero para arritmia
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
        }

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        // Mayor duración para arritmias
        osc.stop(ctx.currentTime + (type === 'arrhythmia' ? 0.25 : 0.1));
      } catch (error) {
        console.error('Error generando audio:', error);
      }
    }
  };

  return trigger;
}


import { useEffect, useRef } from 'react';
import { FeedbackService } from '@/services/FeedbackService';

/**
 * Tipos de retroalimentación para latidos
 */
export type HeartbeatFeedbackType = 'normal' | 'arrhythmia';

/**
 * Hook que proporciona retroalimentación táctil y auditiva para los latidos cardíacos
 * con sincronización natural entre componentes
 * @param enabled Activa o desactiva la retroalimentación
 * @returns Función para activar la retroalimentación con tipo específico
 */
export function useHeartbeatFeedback(enabled: boolean = true) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const lastFeedbackTimeRef = useRef<number>(0);
  const MIN_FEEDBACK_INTERVAL = 300; // ms entre eventos de feedback

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
   * Activa la retroalimentación táctil y auditiva sincronizada
   * @param type Tipo de retroalimentación: normal o arritmia
   * @param intensity Intensidad del feedback (0-1)
   */
  const trigger = (type: HeartbeatFeedbackType = 'normal', intensity: number = 1) => {
    if (!enabled) return false;
    
    const now = Date.now();
    // Evitar exceso de eventos de feedback
    if (now - lastFeedbackTimeRef.current < MIN_FEEDBACK_INTERVAL) {
      return false;
    }
    
    lastFeedbackTimeRef.current = now;

    // SINCRONIZACIÓN NATURAL: aplicar todos los tipos de feedback juntos
    
    // 1. Feedback táctil (vibración)
    if ('vibrate' in navigator) {
      if (type === 'normal') {
        // Vibración simple para latido normal
        navigator.vibrate(50);
      } else if (type === 'arrhythmia') {
        // Patrón de vibración distintivo para arritmia (pulso doble)
        navigator.vibrate([50, 100, 100]);
        
        // Para arritmias, también usar el FeedbackService para notificación complementaria
        // pero solo ocasionalmente para no saturar
        if (Math.random() > 0.7) { // Solo en ~30% de los casos
          FeedbackService.signalArrhythmia(1);
        }
      }
    }

    // 2. Feedback auditivo (beep)
    if (audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === 'normal') {
        // Tono normal para latido regular
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.05 * intensity, ctx.currentTime);
      } else if (type === 'arrhythmia') {
        // Tono más grave y duradero para arritmia
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.08 * intensity, ctx.currentTime);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      // Mayor duración para arritmias
      osc.stop(ctx.currentTime + (type === 'arrhythmia' ? 0.2 : 0.1));
    }
    
    return true;
  };

  return trigger;
}

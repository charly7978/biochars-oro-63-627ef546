
import { useEffect, useRef } from 'react';
import { VitalSignsConfig } from '../core/config/VitalSignsConfig';

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

    // Get feedback config based on type
    const config = type === 'normal' 
      ? VitalSignsConfig.feedback.HEARTBEAT_NORMAL
      : VitalSignsConfig.feedback.HEARTBEAT_ARRHYTHMIA;

    // Patrones de vibración
    if ('vibrate' in navigator) {
      navigator.vibrate(config.VIBRATION_PATTERN);
    }

    // Generar un bip con características según el tipo
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = config.AUDIO_TYPE as OscillatorType;
    osc.frequency.setValueAtTime(config.AUDIO_FREQUENCY, ctx.currentTime);
    gain.gain.setValueAtTime(config.AUDIO_GAIN, ctx.currentTime);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + config.AUDIO_DURATION);
  };

  return trigger;
}

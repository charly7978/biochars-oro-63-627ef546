
import { useEffect, useRef } from 'react';

/**
 * Tipos de retroalimentación para latidos
 */
export type HeartbeatFeedbackType = 'normal' | 'arrhythmia' | 'bradycardia' | 'tachycardia' | 'irregular' | 'extrasystole';

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
   * @param type Tipo de retroalimentación: normal o varios tipos de arritmia
   */
  const trigger = (type: HeartbeatFeedbackType = 'normal') => {
    if (!enabled || !audioCtxRef.current) return;

    // Patrones de vibración - ASEGURARSE QUE SE EJECUTE INMEDIATAMENTE
    if ('vibrate' in navigator) {
      try {
        switch (type) {
          case 'normal':
            // Vibración simple para latido normal - más intensa
            navigator.vibrate(80);
            console.log('🔆 Vibración normal activada');
            break;
          case 'arrhythmia':
            // Patrón de vibración distintivo para arritmia (pulso doble)
            navigator.vibrate([80, 100, 120]);
            console.log('⚠️ Vibración de arritmia activada');
            break;
          case 'bradycardia':
            // Vibración fuerte y larga para bradicardia
            navigator.vibrate([150, 50, 150]);
            console.log('⚠️ Vibración de bradicardia activada');
            break;
          case 'tachycardia':
            // Vibraciones rápidas para taquicardia
            navigator.vibrate([50, 30, 50, 30, 50]);
            console.log('⚠️ Vibración de taquicardia activada');
            break;
          case 'irregular':
            // Patrón irregular para ritmo irregular
            navigator.vibrate([60, 120, 80, 50, 120]);
            console.log('⚠️ Vibración de ritmo irregular activada');
            break;
          case 'extrasystole':
            // Un pulso fuerte seguido de uno más débil para extrasístole
            navigator.vibrate([150, 60, 50]);
            console.log('⚠️ Vibración de extrasístole activada');
            break;
        }
      } catch (error) {
        console.error('Error al activar vibración:', error);
      }
    } else {
      console.warn('API de vibración no disponible en este dispositivo');
    }

    // Generar un bip con características según el tipo
    try {
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      switch (type) {
        case 'normal':
          // Tono normal para latido regular
          osc.type = 'square';
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          gain.gain.setValueAtTime(0.05, ctx.currentTime);
          break;
        case 'arrhythmia':
          // Tono más grave y duradero para arritmia
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          break;
        case 'bradycardia':
          // Tono grave para bradicardia
          osc.type = 'sine';
          osc.frequency.setValueAtTime(330, ctx.currentTime);
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          break;
        case 'tachycardia':
          // Tono agudo para taquicardia
          osc.type = 'square';
          osc.frequency.setValueAtTime(1100, ctx.currentTime);
          gain.gain.setValueAtTime(0.06, ctx.currentTime);
          break;
        case 'irregular':
          // Tono disonante para ritmos irregulares
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(550, ctx.currentTime);
          gain.gain.setValueAtTime(0.07, ctx.currentTime);
          break;
        case 'extrasystole':
          // Doble tono para extrasístole
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(660, ctx.currentTime);
          gain.gain.setValueAtTime(0.09, ctx.currentTime);
          break;
      }

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      // Mayor duración para arritmias
      const duration = type === 'normal' ? 0.1 : 0.2;
      osc.stop(ctx.currentTime + duration);
    } catch (error) {
      console.error('Error al reproducir audio:', error);
    }
  };

  return trigger;
}

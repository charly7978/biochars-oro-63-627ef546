
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
  const lastTriggerTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    
    // Inicializar contexto de audio
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log("useHeartbeatFeedback: Audio context initialized successfully");
      } catch (err) {
        console.error("useHeartbeatFeedback: Error initializing audio context:", err);
      }
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
   * Activa la retroalimentación táctil y auditiva - solo utiliza datos reales
   * @param type Tipo de retroalimentación: normal o arritmia
   */
  const trigger = (type: HeartbeatFeedbackType = 'normal') => {
    if (!enabled) return;
    
    const now = Date.now();
    const MIN_TRIGGER_INTERVAL = 150; // Milliseconds between triggers
    
    if (now - lastTriggerTimeRef.current < MIN_TRIGGER_INTERVAL) {
      return; // Evitar vibraciones demasiado frecuentes
    }
    
    lastTriggerTimeRef.current = now;

    // Activar vibración con patrones específicos según el tipo
    if ('vibrate' in navigator) {
      try {
        if (type === 'normal') {
          // Vibración simple para latido normal
          navigator.vibrate(60);
          console.log('Vibración normal activada');
        } else if (type === 'arrhythmia') {
          // Patrón de vibración distintivo para arritmia
          navigator.vibrate([70, 50, 140]);
          console.log('Vibración de arritmia activada');
        }
      } catch (error) {
        console.error('Error al activar vibración:', error);
      }
    } else {
      console.log('Vibración no soportada en este dispositivo');
    }

    // Generar beep audible - solo utiliza datos reales
    if (audioCtxRef.current) {
      try {
        const ctx = audioCtxRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        if (type === 'normal') {
          // Tono normal para latido regular
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
        } else if (type === 'arrhythmia') {
          // Tono más grave para arritmia
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          gain.gain.setValueAtTime(0.12, ctx.currentTime);
        }

        // Configurar curva de ataque/relajo para sonido claro
        gain.gain.linearRampToValueAtTime(type === 'normal' ? 0.08 : 0.12, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (type === 'normal' ? 0.1 : 0.2));

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + (type === 'arrhythmia' ? 0.25 : 0.12));
        
        console.log(`Beep de ${type} reproducido exitosamente`);
      } catch (error) {
        console.error('Error generando audio:', error);
      }
    } else {
      console.log('Audio context no disponible para beep');
    }
  };

  return trigger;
}

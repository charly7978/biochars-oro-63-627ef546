
import { useEffect, useRef } from 'react';

/**
 * Hook que proporciona retroalimentación táctil y auditiva para los latidos cardíacos
 * @param enabled Activa o desactiva la retroalimentación
 * @returns Función para activar la retroalimentación
 */
export function useHeartbeatFeedback(enabled: boolean = true) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const lastTriggerTimeRef = useRef<number>(0);
  const MIN_TRIGGER_INTERVAL = 250; // milisegundos entre vibraciones para evitar sobrecargas

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

  const trigger = () => {
    if (!enabled) return;

    const now = Date.now();
    // Limitar la frecuencia de retroalimentación para evitar vibraciones excesivas
    if (now - lastTriggerTimeRef.current < MIN_TRIGGER_INTERVAL) {
      return;
    }
    lastTriggerTimeRef.current = now;

    // Vibración táctil siempre que esté disponible
    if ('vibrate' in navigator) {
      navigator.vibrate(50); // vibración corta de 50ms
      console.log("Vibración activada para latido cardíaco");
    }

    // Generar un bip sencillo con oscilador si tenemos contexto de audio
    if (audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // Frecuencia aguda
      gain.gain.setValueAtTime(0.05, ctx.currentTime); // volumen suave

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.1); // corta a los 100ms
    }
  };

  return trigger;
}

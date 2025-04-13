
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
    
    // Inicializar contexto de audio
    try {
      // Inicializar inmediatamente para permitir interacción del usuario
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log("useHeartbeatFeedback: AudioContext inicializado correctamente");
      }
      
      // Intentar reanudar el contexto de audio (importante para navegadores móviles)
      if (audioCtxRef.current.state !== 'running') {
        audioCtxRef.current.resume().catch(err => {
          console.error('Error resumiendo el contexto de audio:', err);
        });
      }
    } catch (err) {
      console.error('Error inicializando AudioContext:', err);
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
   * @param intensity Intensidad del latido (0-1)
   */
  const trigger = (type: HeartbeatFeedbackType = 'normal', intensity: number = 0.7) => {
    if (!enabled) return;
    
    const now = Date.now();
    const MIN_TRIGGER_INTERVAL = 250; // 250ms entre vibraciones para evitar saturación
    
    if (now - lastTriggerTimeRef.current < MIN_TRIGGER_INTERVAL) {
      return; // Evitar vibraciones demasiado frecuentes
    }
    
    lastTriggerTimeRef.current = now;
    
    // Normalizar intensidad entre 0.3 y 1.0 para garantizar un mínimo audible
    const normalizedIntensity = Math.max(0.3, Math.min(1.0, intensity));
    
    // Patrones de vibración claramente diferenciados con múltiples intentos
    if ('vibrate' in navigator) {
      try {
        if (type === 'normal') {
          // Vibración más fuerte para latido normal
          navigator.vibrate([100]);
          console.log('Vibración normal activada con intensidad:', normalizedIntensity);
        } else if (type === 'arrhythmia') {
          // Patrón de vibración distintivo para arritmia (pulso doble más fuerte)
          navigator.vibrate([120, 50, 120]);
          console.log('Vibración de arritmia activada con intensidad:', normalizedIntensity);
        }
      } catch (error) {
        console.error('Error al activar vibración:', error);
        
        // Segundo intento con un patrón más simple
        try {
          navigator.vibrate(100);
          console.log('Segundo intento de vibración activado');
        } catch (retryError) {
          console.error('Error en segundo intento de vibración:', retryError);
        }
      }
    } else {
      console.log('API de vibración no disponible en este dispositivo');
    }

    // Generar un bip con volumen dinámico según la intensidad
    if (audioCtxRef.current) {
      try {
        const ctx = audioCtxRef.current;
        
        // Forzar reanudar el contexto de audio (importante para navegadores móviles)
        if (ctx.state !== 'running') {
          ctx.resume().catch(err => {
            console.error('Error resumiendo el contexto de audio:', err);
          });
        }
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        if (type === 'normal') {
          // Tono normal para latido regular con volumen dinámico
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          // Volumen proporcional a la intensidad del latido
          gain.gain.setValueAtTime(normalizedIntensity * 0.15, ctx.currentTime);
        } else if (type === 'arrhythmia') {
          // Tono más grave y duradero para arritmia con volumen dinámico
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          // Volumen mayor para arritmias, pero igualmente proporcionado
          gain.gain.setValueAtTime(normalizedIntensity * 0.2, ctx.currentTime);
        }

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        // Mayor duración para arritmias
        osc.stop(ctx.currentTime + (type === 'arrhythmia' ? 0.3 : 0.15));
        
        console.log(`Audio generado: tipo=${type}, intensidad=${normalizedIntensity}, volumen=${type === 'normal' ? normalizedIntensity * 0.15 : normalizedIntensity * 0.2}`);
      } catch (error) {
        console.error('Error generando audio:', error);
      }
    }
  };

  return trigger;
}

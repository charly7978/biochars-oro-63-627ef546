
import { useEffect, useRef, useCallback } from 'react';
import FeedbackService from '@/services/FeedbackService';

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
  const lastFeedbackTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    
    // Configurar contexto de audio si está disponible
    if (typeof window !== 'undefined' && !audioCtxRef.current) {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          audioCtxRef.current = new AudioContext();
          console.log("useHeartbeatFeedback: Audio context initialized");
        }
      } catch (err) {
        console.error("useHeartbeatFeedback: Error initializing audio context", err);
      }
    }
    
    // Prueba de sonido y vibración al inicializar
    const testFeedbackOnLoad = async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log("useHeartbeatFeedback: Testing feedback");
      FeedbackService.vibrate(100);
      FeedbackService.playSound('notification');
    };
    
    testFeedbackOnLoad();
    
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
  const trigger = useCallback((type: HeartbeatFeedbackType = 'normal') => {
    if (!enabled) return;

    const now = Date.now();
    // Limitar la frecuencia de retroalimentación a máximo 1 cada 250ms
    if (now - lastFeedbackTimeRef.current < 250) {
      return;
    }
    lastFeedbackTimeRef.current = now;

    console.log(`useHeartbeatFeedback: Triggering ${type} feedback`);
    
    // Reproducir sonido según el tipo
    FeedbackService.playSound('heartbeat');
    
    // Aplicar vibración según el tipo
    if (type === 'normal') {
      FeedbackService.vibrate(50); // Vibración corta para latido normal
    } else if (type === 'arrhythmia') {
      FeedbackService.vibrate([50, 100, 50]); // Patrón para arritmia
    }
    
  }, [enabled]);

  return trigger;
}


import { useEffect, useRef } from 'react';
import FeedbackService from '../services/FeedbackService';

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
  const MIN_INTERVAL_MS = 300; // Evitar demasiadas activaciones

  useEffect(() => {
    if (!enabled) return;
    
    // Inicializar contexto de audio si está habilitado
    try {
      if (!audioCtxRef.current && typeof AudioContext !== 'undefined') {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      // Asegurar que el contexto esté ejecutándose
      if (audioCtxRef.current && audioCtxRef.current.state !== 'running') {
        console.log("useHeartbeatFeedback: Intentando reanudar contexto de audio");
        audioCtxRef.current.resume().catch(err => {
          console.error("Error reanudando contexto de audio:", err);
        });
      }
    } catch (err) {
      console.error("Error inicializando contexto de audio:", err);
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
    if (now - lastTriggerTimeRef.current < MIN_INTERVAL_MS) {
      return;
    }
    
    lastTriggerTimeRef.current = now;
    
    // Usar el servicio centralizado para la retroalimentación
    FeedbackService.triggerHeartbeat(audioCtxRef.current, type);
    
    console.log(`Retroalimentación de latido activada: ${type}`, { 
      tiempo: new Date().toISOString() 
    });
  };

  return trigger;
}

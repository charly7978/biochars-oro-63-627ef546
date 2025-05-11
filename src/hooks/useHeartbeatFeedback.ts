
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useCallback, useRef } from 'react';
import { FeedbackService } from '../services/FeedbackService';

export type HeartbeatFeedbackType = 'normal' | 'arrhythmia';

/**
 * Hook para gestionar feedback de latido cardíaco (vibración y sonido)
 */
export const useHeartbeatFeedback = () => {
  const feedbackService = useRef<FeedbackService>(FeedbackService.getInstance());
  const lastFeedbackTimeRef = useRef<number>(0);
  const MIN_FEEDBACK_INTERVAL_MS = 350; // Intervalo mínimo entre feedback
  
  /**
   * Ejecuta feedback táctil y sonoro para latidos
   * @param type Tipo de latido (normal o arritmia)
   * @returns true si el feedback fue ejecutado, false si fue filtrado
   */
  const triggerHeartbeatFeedback = useCallback((type: HeartbeatFeedbackType = 'normal'): boolean => {
    const now = Date.now();
    
    // Limitar frecuencia de feedback para evitar sobrecargas
    if (now - lastFeedbackTimeRef.current < MIN_FEEDBACK_INTERVAL_MS) {
      return false;
    }
    
    // Reproducir sonido y vibración según tipo
    if (type === 'arrhythmia') {
      feedbackService.current.triggerHeartbeatFeedback(true);
    } else {
      feedbackService.current.triggerHeartbeatFeedback(false);
    }
    
    lastFeedbackTimeRef.current = now;
    return true;
  }, []);
  
  return triggerHeartbeatFeedback;
};

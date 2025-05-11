
import { useEffect } from 'react';
import AudioFeedbackService from '@/services/AudioFeedbackService';

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
  useEffect(() => {
    if (!enabled) return;
    
    // Cleanup al desmontar
    return () => {
      // No cleanup needed - service handles its own lifecycle
    };
  }, [enabled]);

  /**
   * Activa la retroalimentación táctil y auditiva - solo utiliza datos reales
   * @param type Tipo de retroalimentación: normal o arritmia
   */
  const trigger = (type: HeartbeatFeedbackType = 'normal') => {
    if (!enabled) return;
    
    // Usar el nuevo método que centraliza la gestión de audio
    AudioFeedbackService.triggerHeartbeatFeedback(type);
  };

  return trigger;
}

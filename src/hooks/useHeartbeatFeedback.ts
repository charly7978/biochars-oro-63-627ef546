
import { useCallback } from 'react';
import AudioFeedbackService from '../services/AudioFeedbackService';

export function useHeartbeatFeedback(enabled: boolean = true) {
  const triggerBeep = useCallback((type: 'normal' | 'arrhythmia' = 'normal') => {
    if (!enabled) return;
    
    const volume = type === 'arrhythmia' ? 0.8 : 0.7;
    AudioFeedbackService.playBeep(type === 'arrhythmia' ? 'arrhythmia' : 'heartbeat', volume);
  }, [enabled]);

  return triggerBeep;
}

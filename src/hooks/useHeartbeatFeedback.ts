
import { useCallback } from 'react';
import AudioFeedbackService from '@/services/AudioFeedbackService';

export type HeartbeatFeedbackType = 'normal' | 'arrhythmia';

export const useHeartbeatFeedback = () => {
  const playHeartbeatSound = useCallback((type: HeartbeatFeedbackType = 'normal') => {
    return AudioFeedbackService.playBeep(type);
  }, []);

  const playAlertSound = useCallback((type: 'arrhythmia' | 'warning' | 'error' = 'arrhythmia') => {
    return AudioFeedbackService.playAlertSound(type);
  }, []);

  return {
    playHeartbeatSound,
    playAlertSound
  };
};

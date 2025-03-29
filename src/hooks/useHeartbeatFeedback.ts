
import { useCallback } from 'react';

export type HeartbeatFeedbackType = 'normal' | 'arrhythmia';

export function useHeartbeatFeedback() {
  // This hook provides feedback for heartbeats (visual, haptic, audio)
  
  const triggerHeartbeatFeedback = useCallback((type: HeartbeatFeedbackType = 'normal') => {
    try {
      // Haptic feedback if available
      if (navigator.vibrate) {
        if (type === 'normal') {
          navigator.vibrate(40);
        } else if (type === 'arrhythmia') {
          navigator.vibrate([40, 50, 40]);
        }
      }
      
      return true;
    } catch (error) {
      console.error("Error triggering heartbeat feedback:", error);
      return false;
    }
  }, []);
  
  return triggerHeartbeatFeedback;
}

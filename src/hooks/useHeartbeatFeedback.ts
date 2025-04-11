
import { useEffect, useRef, useState } from 'react';

/**
 * Tipos de retroalimentación para latidos
 */
export type HeartbeatFeedbackType = 'normal' | 'arrhythmia';

/**
 * Hook that previously provided audio feedback - now disabled per request
 * @param enabled No longer used as all audio is disabled
 * @returns Function that now returns false always
 */
export function useHeartbeatFeedback(enabled: boolean = true) {
  // All audio functionality has been removed as requested
  
  // Return a function that does nothing and always returns false
  const trigger = (type: HeartbeatFeedbackType = 'normal'): boolean => {
    // Audio functionality has been removed per request
    return false;
  };

  return trigger;
}


import { useCallback } from 'react';

/**
 * Hook for providing haptic feedback on supported devices
 */
export function useHapticFeedback() {
  /**
   * Trigger haptic feedback with the specified pattern
   * @param pattern Vibration pattern (single duration or pattern array)
   * @returns True if vibration was attempted, false otherwise
   */
  const playHaptic = useCallback((pattern: number | number[] = 200): boolean => {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
        return true;
      } catch (error) {
        console.error('Error triggering haptic feedback:', error);
      }
    }
    return false;
  }, []);

  return { playHaptic };
}

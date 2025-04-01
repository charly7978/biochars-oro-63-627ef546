
import { useCallback, useRef } from 'react';

type SoundType = 'success' | 'error' | 'notification' | 'heartbeat' | 'weak-signal' | 'improved-signal';

/**
 * Hook for playing audio feedback
 */
export function useAudioFeedback() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  
  /**
   * Play a sound with the given type
   * @param type Type of sound to play
   * @param volume Optional volume (0-1)
   * @returns True if playback was attempted, false otherwise
   */
  const playAudio = useCallback((type: SoundType = 'heartbeat', volume: number = 0.5): boolean => {
    try {
      // Sound URL mapping based on type
      const soundMap: Record<SoundType, string> = {
        'success': '/sounds/success.mp3',
        'error': '/sounds/error.mp3',
        'notification': '/sounds/notification.mp3',
        'heartbeat': '/sounds/heartbeat.mp3',
        'weak-signal': '/sounds/heartbeat.mp3', // Fallback to heartbeat sound
        'improved-signal': '/sounds/success.mp3' // Fallback to success sound
      };
      
      const soundUrl = soundMap[type];
      
      // Get or create audio element
      let audioElement = audioElementsRef.current.get(soundUrl);
      if (!audioElement) {
        audioElement = new Audio(soundUrl);
        audioElementsRef.current.set(soundUrl, audioElement);
      }
      
      // Reset audio position if it's currently playing
      if (!audioElement.paused) {
        audioElement.currentTime = 0;
      }
      
      // Set volume and play
      audioElement.volume = Math.min(1, Math.max(0, volume));
      const playPromise = audioElement.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error("Error playing audio:", error);
        });
      }
      
      return true;
    } catch (error) {
      console.error("Error in audio playback:", error);
      return false;
    }
  }, []);
  
  return { playAudio };
}

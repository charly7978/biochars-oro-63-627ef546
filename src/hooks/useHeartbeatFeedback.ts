
import { useEffect, useRef, useState, useCallback } from 'react';
import { useHapticFeedback } from './useHapticFeedback';
import { useAudioFeedback } from './useAudioFeedback';

/**
 * Options for heartbeat feedback
 */
export interface HeartbeatFeedbackOptions {
  hapticEnabled?: boolean;
  audioEnabled?: boolean;
  bpm?: number;
  signalQuality?: number;
  isFingerDetected?: boolean;
  motionDetected?: boolean;
  motionCompensationActive?: boolean;
}

/**
 * Hook that provides haptic and audio feedback for heartbeats
 */
export function useHeartbeatFeedback(
  enabled: boolean = true,
  options: HeartbeatFeedbackOptions = {}
) {
  const { playHaptic } = useHapticFeedback();
  const { playAudio } = useAudioFeedback();
  
  const [signalQuality, setSignalQuality] = useState(0);
  const lastTriggerTimeRef = useRef(0);
  
  // Default options
  const {
    hapticEnabled = true,
    audioEnabled = true,
    bpm = 0,
    signalQuality: externalQuality = 0,
    isFingerDetected = false,
    motionDetected = false,
    motionCompensationActive = false
  } = options;
  
  // Update signal quality
  useEffect(() => {
    if (externalQuality > 0) {
      setSignalQuality(externalQuality);
    }
  }, [externalQuality]);
  
  /**
   * Update the signal quality value
   */
  const updateSignalQuality = useCallback((quality: number) => {
    setSignalQuality(quality);
  }, []);
  
  /**
   * Trigger feedback for heartbeat
   */
  const trigger = useCallback(() => {
    if (!enabled) return false;
    
    const now = Date.now();
    // Prevent triggering too frequently (at least 200ms between triggers)
    if (now - lastTriggerTimeRef.current < 200) {
      return false;
    }
    
    lastTriggerTimeRef.current = now;
    
    // Apply haptic feedback if enabled
    if (hapticEnabled) {
      playHaptic(50);
    }
    
    // Apply audio feedback if enabled
    if (audioEnabled) {
      // Different sound based on signal quality
      if (signalQuality < 30) {
        playAudio('weak-signal', 0.3);
      } else if (signalQuality > 70) {
        playAudio('heartbeat', 0.7);
      } else {
        playAudio('heartbeat', 0.5);
      }
    }
    
    return true;
  }, [enabled, hapticEnabled, audioEnabled, playHaptic, playAudio, signalQuality]);
  
  return { trigger, updateSignalQuality };
}

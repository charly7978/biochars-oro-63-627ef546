
import { useEffect, useRef } from 'react';

export type HeartbeatFeedbackType = 'normal' | 'arrhythmia';

export function useHeartbeatFeedback(enabled: boolean = true) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const lastTriggerTimeRef = useRef<number>(0);
  const vibrationPermissionRequestedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) return;
    
    try {
      // Only initialize audio context when needed, not on component mount
      if (!audioCtxRef.current && typeof window !== 'undefined') {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      // Try to request vibration permission by using a minimal vibration test
      if ('vibrate' in navigator && !vibrationPermissionRequestedRef.current) {
        try {
          navigator.vibrate(0); // Using 0 to just request permission without actual vibration
          vibrationPermissionRequestedRef.current = true;
          console.log("Vibration permission requested");
        } catch (err) {
          console.error('Vibration permission error:', err);
        }
      }
    } catch (err) {
      console.error('Audio context initialization error:', err);
    }
    
    return () => {
      if (oscillatorRef.current) {
        try {
          oscillatorRef.current.stop();
          oscillatorRef.current.disconnect();
          oscillatorRef.current = null;
        } catch (err) {
          console.error('Oscillator cleanup error:', err);
        }
      }
    };
  }, [enabled]);

  const trigger = (type: HeartbeatFeedbackType = 'normal', intensity: number = 0.7) => {
    if (!enabled) return;
    
    const now = Date.now();
    const MIN_TRIGGER_INTERVAL = 250;
    
    if (now - lastTriggerTimeRef.current < MIN_TRIGGER_INTERVAL) return;
    
    lastTriggerTimeRef.current = now;
    const normalizedIntensity = Math.max(0.3, Math.min(1.0, intensity));
    
    // ONLY vibrate, no sound (centralized in PPGSignalMeter)
    if ('vibrate' in navigator) {
      try {
        if (type === 'normal') {
          // Strong single vibration for normal heartbeats
          const duration = Math.round(100 * normalizedIntensity);
          navigator.vibrate(duration);
          console.log(`Vibration triggered: normal (${duration}ms)`);
        } else if (type === 'arrhythmia') {
          // Special pattern for arrhythmias: triple pulse
          navigator.vibrate([100, 30, 100, 30, 100]);
          console.log("Vibration triggered: arrhythmia pattern");
        }
      } catch (error) {
        console.error('Vibration error:', error);
      }
    } else {
      console.warn('Vibration API not available on this device');
    }
  };

  return trigger;
}


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
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      if (audioCtxRef.current && audioCtxRef.current.state !== 'running') {
        audioCtxRef.current.resume().catch(console.error);
      }
      
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate(1);
          vibrationPermissionRequestedRef.current = true;
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
      
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(console.error);
        audioCtxRef.current = null;
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
    
    if ('vibrate' in navigator) {
      try {
        if (type === 'normal') {
          navigator.vibrate(200 * normalizedIntensity);
        } else if (type === 'arrhythmia') {
          navigator.vibrate([200, 100, 200]);
        }
      } catch (error) {
        console.error('Vibration error:', error);
      }
    }
  };

  return trigger;
}


import { useCallback, useRef } from 'react';

interface UseHeartbeatFeedbackOptions {
  volume?: number;
  frequency?: number;
  duration?: number;
}

export const useHeartbeatFeedback = (
  isFingerDetected: boolean = false,
  isArrhythmia: boolean = false,
  options: UseHeartbeatFeedbackOptions = {}
) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const { 
    volume = 0.3, 
    frequency = isArrhythmia ? 880 : 660, 
    duration = 80 
  } = options;

  const createAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    try {
      if (!audioContextRef.current) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          audioContextRef.current = new AudioContext();
        }
      }
    } catch (error) {
      console.error("Could not create audio context:", error);
    }
  }, []);

  const playHeartbeat = useCallback(() => {
    if (!isFingerDetected) return;
    
    try {
      createAudioContext();
      const ctx = audioContextRef.current;
      
      if (!ctx) return;
      
      // Create oscillator
      const oscillator = ctx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      oscillatorRef.current = oscillator;
      
      // Create gain node for volume control
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + (duration / 1000));
      gainNodeRef.current = gainNode;
      
      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      // Play and stop
      oscillator.start();
      oscillator.stop(ctx.currentTime + (duration / 1000));
      
      // Clean up
      oscillator.onended = () => {
        oscillatorRef.current = null;
        gainNodeRef.current = null;
      };
    } catch (error) {
      console.error("Error playing heartbeat sound:", error);
    }
  }, [isFingerDetected, isArrhythmia, volume, frequency, duration, createAudioContext]);

  return { playHeartbeat };
};

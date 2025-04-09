
import { useCallback, useRef } from 'react';

export function useBeepProcessor() {
  const pendingBeepsQueue = useRef<number[]>([]);
  const lastBeepTimeRef = useRef<number>(0);
  const beepProcessorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isAudioInitializedRef = useRef<boolean>(false);
  
  const initializeAudio = useCallback(() => {
    if (typeof window === 'undefined' || isAudioInitializedRef.current) return;
    
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        audioContextRef.current = new AudioContext();
        isAudioInitializedRef.current = true;
        console.log('BeepProcessor: Audio context initialized');
      }
    } catch (error) {
      console.warn('BeepProcessor: Audio context initialization failed', error);
    }
  }, []);
  
  const requestImmediateBeep = useCallback((value: number): boolean => {
    const currentTime = Date.now();
    const timeSinceLastBeep = currentTime - lastBeepTimeRef.current;
    
    // Prevent beeps too close together to avoid overwhelming audio
    if (timeSinceLastBeep < 300) {
      return false;
    }
    
    if (!isAudioInitializedRef.current) {
      initializeAudio();
    }
    
    // Add beep request to queue
    pendingBeepsQueue.current.push(value);
    
    // Start processing beeps if not already doing so
    if (!beepProcessorTimeoutRef.current) {
      processBeepQueue();
    }
    
    return true;
  }, [initializeAudio]);
  
  const processBeepQueue = useCallback(() => {
    if (pendingBeepsQueue.current.length === 0) {
      beepProcessorTimeoutRef.current = null;
      return;
    }
    
    const value = pendingBeepsQueue.current.shift();
    const currentTime = Date.now();
    
    if (audioContextRef.current && value !== undefined) {
      try {
        const oscillator = audioContextRef.current.createOscillator();
        const gainNode = audioContextRef.current.createGain();
        
        // Configure oscillator
        oscillator.type = 'sine';
        oscillator.frequency.value = 587.33; // D5
        
        // Configure gain (volume)
        gainNode.gain.value = 0.1;
        
        // Connect nodes
        oscillator.connect(gainNode);
        gainNode.connect(audioContextRef.current.destination);
        
        // Schedule envelope
        const now = audioContextRef.current.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.1, now + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.1);
        
        // Start and stop
        oscillator.start(now);
        oscillator.stop(now + 0.1);
        
        lastBeepTimeRef.current = currentTime;
      } catch (error) {
        console.warn('BeepProcessor: Error generating beep', error);
      }
    }
    
    // Schedule next beep processing
    beepProcessorTimeoutRef.current = setTimeout(processBeepQueue, 100);
  }, []);
  
  const cleanup = useCallback(() => {
    if (beepProcessorTimeoutRef.current) {
      clearTimeout(beepProcessorTimeoutRef.current);
      beepProcessorTimeoutRef.current = null;
    }
    
    pendingBeepsQueue.current = [];
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
        audioContextRef.current = null;
        isAudioInitializedRef.current = false;
      } catch (error) {
        console.warn('BeepProcessor: Error closing audio context', error);
      }
    }
  }, []);
  
  return {
    requestImmediateBeep,
    processBeepQueue,
    pendingBeepsQueue,
    lastBeepTimeRef,
    beepProcessorTimeoutRef,
    cleanup,
    initializeAudio,
    isAudioInitializedRef
  };
}

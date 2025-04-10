
import { useCallback, useRef } from 'react';

interface BeepRequest {
  value: number;
  timestamp: number;
}

export function useBeepProcessor() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastBeepTimeRef = useRef<number>(0);
  const pendingBeepsQueue = useRef<BeepRequest[]>([]);
  const beepProcessorTimeoutRef = useRef<number | null>(null);
  
  const initAudioContext = useCallback(async () => {
    try {
      if (!audioContextRef.current && typeof AudioContext !== 'undefined') {
        audioContextRef.current = new AudioContext();
        
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        
        return true;
      }
      return !!audioContextRef.current;
    } catch (error) {
      console.error('Error initializing audio context:', error);
      return false;
    }
  }, []);
  
  const playBeep = useCallback(async (value: number): Promise<boolean> => {
    try {
      const ready = await initAudioContext();
      if (!ready || !audioContextRef.current) {
        return false;
      }
      
      const MIN_BEEP_INTERVAL = 250;
      const now = Date.now();
      
      if (now - lastBeepTimeRef.current < MIN_BEEP_INTERVAL) {
        return false;
      }
      
      const oscillator = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      
      gainNode.gain.value = 0.1;
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      
      oscillator.start();
      oscillator.stop(audioContextRef.current.currentTime + 0.1);
      
      lastBeepTimeRef.current = now;
      return true;
    } catch (error) {
      console.error('Error playing beep:', error);
      return false;
    }
  }, [initAudioContext]);
  
  const requestImmediateBeep = useCallback((value: number): boolean => {
    // We'll provide a synchronous return value and handle the async operation internally
    const now = Date.now();
    const MIN_BEEP_INTERVAL = 250;
    
    // Check if we've played a beep recently
    if (now - lastBeepTimeRef.current < MIN_BEEP_INTERVAL) {
      return false;
    }
    
    // Queue the beep request
    pendingBeepsQueue.current.push({ value, timestamp: now });
    
    // Start processing the queue if not already processing
    if (!beepProcessorTimeoutRef.current) {
      processBeepQueue();
    }
    
    // Return true indicating the beep was requested (not necessarily played yet)
    return true;
  }, []);
  
  const processBeepQueue = useCallback(() => {
    if (pendingBeepsQueue.current.length === 0) {
      beepProcessorTimeoutRef.current = null;
      return;
    }
    
    const request = pendingBeepsQueue.current.shift();
    if (request) {
      playBeep(request.value).catch(error => {
        console.error('Error in playBeep:', error);
      });
    }
    
    // Schedule the next beep processing
    beepProcessorTimeoutRef.current = window.setTimeout(processBeepQueue, 10);
  }, [playBeep]);
  
  const cleanup = useCallback(() => {
    if (beepProcessorTimeoutRef.current) {
      clearTimeout(beepProcessorTimeoutRef.current);
      beepProcessorTimeoutRef.current = null;
    }
    
    pendingBeepsQueue.current = [];
    
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(err => {
        console.error('Error closing audio context:', err);
      });
      audioContextRef.current = null;
    }
  }, []);
  
  return {
    requestImmediateBeep,
    processBeepQueue,
    pendingBeepsQueue,
    lastBeepTimeRef,
    beepProcessorTimeoutRef,
    cleanup
  };
}

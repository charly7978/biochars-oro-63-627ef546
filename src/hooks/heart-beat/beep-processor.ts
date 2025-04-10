
import { useState, useCallback, useRef } from 'react';

export function useBeepProcessor() {
  const pendingBeepsQueue = useRef<{time: number, value: number}[]>([]);
  const beepProcessorTimeoutRef = useRef<number | null>(null);
  const lastBeepTimeRef = useRef<number>(0);
  
  // Simplified method that doesn't do any actual processing
  const processBeepQueue = useCallback(() => {
    // Sound handling is now managed exclusively by PPGSignalMeter
    console.log("BeepProcessor: Sound managed exclusively by PPGSignalMeter");
    pendingBeepsQueue.current = []; // Clear queue
    return;
  }, []);

  // Simplified method that doesn't trigger any beeps
  const requestImmediateBeep = useCallback((): boolean => {
    // Sound handling is now managed exclusively by PPGSignalMeter
    console.log("BeepProcessor: Beep completely eliminated - sound managed exclusively by PPGSignalMeter");
    return false;
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    pendingBeepsQueue.current = [];
    
    if (beepProcessorTimeoutRef.current) {
      clearTimeout(beepProcessorTimeoutRef.current);
      beepProcessorTimeoutRef.current = null;
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

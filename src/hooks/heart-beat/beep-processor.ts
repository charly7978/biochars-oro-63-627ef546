
import { useCallback, useRef } from 'react';

export const useBeepProcessor = () => {
  const pendingBeepsQueue = useRef<{ timestamp: number; isArrhythmia: boolean }[]>([]);
  const lastBeepTimeRef = useRef<number>(0);
  const beepProcessorTimeoutRef = useRef<number | null>(null);
  const MIN_BEEP_INTERVAL_MS = 250;

  const requestImmediateBeep = useCallback((isArrhythmia: boolean = false): boolean => {
    const now = Date.now();
    
    // Prevent too frequent beeps
    if (now - lastBeepTimeRef.current < MIN_BEEP_INTERVAL_MS) {
      return false;
    }
    
    lastBeepTimeRef.current = now;
    console.log(`Beep processor: Beep requested (arrhythmia: ${isArrhythmia})`);
    
    // In reality, we don't need to play a beep as it's handled by PPGSignalMeter
    return true;
  }, []);

  const processBeepQueue = useCallback(() => {
    if (pendingBeepsQueue.current.length === 0) {
      if (beepProcessorTimeoutRef.current) {
        clearTimeout(beepProcessorTimeoutRef.current);
        beepProcessorTimeoutRef.current = null;
      }
      return;
    }
    
    const nextBeep = pendingBeepsQueue.current[0];
    const now = Date.now();
    
    if (now - lastBeepTimeRef.current >= MIN_BEEP_INTERVAL_MS) {
      requestImmediateBeep(nextBeep.isArrhythmia);
      pendingBeepsQueue.current.shift();
    }
    
    beepProcessorTimeoutRef.current = window.setTimeout(processBeepQueue, 100);
  }, [requestImmediateBeep]);

  const cleanup = useCallback(() => {
    if (beepProcessorTimeoutRef.current) {
      clearTimeout(beepProcessorTimeoutRef.current);
      beepProcessorTimeoutRef.current = null;
    }
    pendingBeepsQueue.current = [];
  }, []);

  return {
    requestImmediateBeep,
    processBeepQueue,
    pendingBeepsQueue,
    lastBeepTimeRef,
    beepProcessorTimeoutRef,
    cleanup
  };
};

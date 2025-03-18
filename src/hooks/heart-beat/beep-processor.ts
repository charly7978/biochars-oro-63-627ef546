import { useState, useCallback, useRef } from 'react';
import { HeartBeatConfig } from '../../modules/heart-beat/config';

export function useBeepProcessor() {
  const pendingBeepsQueue = useRef<{time: number, value: number}[]>([]);
  const beepProcessorTimeoutRef = useRef<number | null>(null);
  const lastBeepTimeRef = useRef<number>(0);
  
  const MIN_BEEP_INTERVAL_MS = HeartBeatConfig.MIN_BEEP_INTERVAL_MS;
  
  const processBeepQueue = useCallback((
    isMonitoringRef: React.MutableRefObject<boolean>,
    lastSignalQualityRef: React.MutableRefObject<number>,
    consecutiveWeakSignalsRef: React.MutableRefObject<number>,
    MAX_CONSECUTIVE_WEAK_SIGNALS: number,
    missedBeepsCounter: React.MutableRefObject<number>,
    playBeep: (volume: number) => boolean | Promise<boolean>
  ) => {
    if (!isMonitoringRef.current) {
      pendingBeepsQueue.current = [];
      return;
    }
    
    if (pendingBeepsQueue.current.length === 0) return;
    
    if (lastSignalQualityRef.current < HeartBeatConfig.MIN_CONFIDENCE * 0.8) {
      pendingBeepsQueue.current = [];
      return;
    }
    
    if (consecutiveWeakSignalsRef.current > MAX_CONSECUTIVE_WEAK_SIGNALS) {
      pendingBeepsQueue.current = [];
      return;
    }
    
    const now = Date.now();
    
    if (now - lastBeepTimeRef.current >= MIN_BEEP_INTERVAL_MS) {
      try {
        pendingBeepsQueue.current.sort((a, b) => a.time - b.time);
        
        if (pendingBeepsQueue.current.length > 1) {
          pendingBeepsQueue.current = [pendingBeepsQueue.current[0]];
        }
        
        if (isMonitoringRef.current) {
          playBeep(0.8);
          lastBeepTimeRef.current = now;
        }
        pendingBeepsQueue.current.shift();
        missedBeepsCounter.current = 0;
      } catch (err) {
        console.error('Error playing beep from queue:', err);
        pendingBeepsQueue.current.shift();
      }
    }
    
    if (pendingBeepsQueue.current.length > 0) {
      if (beepProcessorTimeoutRef.current) {
        clearTimeout(beepProcessorTimeoutRef.current);
      }
      beepProcessorTimeoutRef.current = window.setTimeout(
        () => processBeepQueue(
          isMonitoringRef, 
          lastSignalQualityRef, 
          consecutiveWeakSignalsRef, 
          MAX_CONSECUTIVE_WEAK_SIGNALS, 
          missedBeepsCounter, 
          playBeep
        ), 
        Math.max(50, MIN_BEEP_INTERVAL_MS * 0.4)
      );
    }
  }, [MIN_BEEP_INTERVAL_MS]);

  const requestImmediateBeep = useCallback((
    value: number,
    isMonitoringRef: React.MutableRefObject<boolean>,
    lastSignalQualityRef: React.MutableRefObject<number>,
    consecutiveWeakSignalsRef: React.MutableRefObject<number>,
    MAX_CONSECUTIVE_WEAK_SIGNALS: number,
    missedBeepsCounter: React.MutableRefObject<number>,
    playBeep: (volume: number) => boolean | Promise<boolean>
  ): boolean => {
    if (!isMonitoringRef.current) return false;
    
    if (lastSignalQualityRef.current < HeartBeatConfig.MIN_CONFIDENCE * 0.8 || 
        consecutiveWeakSignalsRef.current > MAX_CONSECUTIVE_WEAK_SIGNALS) {
      return false;
    }
    
    const now = Date.now();
    
    if (now - lastBeepTimeRef.current >= MIN_BEEP_INTERVAL_MS) {
      try {
        console.log("Requesting immediate beep, time since last:", now - lastBeepTimeRef.current);
        
        const success = playBeep(0.8);
        
        if (success) {
          lastBeepTimeRef.current = now;
          missedBeepsCounter.current = 0;
          return true;
        } else {
          console.warn('useHeartBeatProcessor: Beep failed to play immediately');
          missedBeepsCounter.current++;
        }
      } catch (err) {
        console.error('Error playing immediate beep:', err);
        missedBeepsCounter.current++;
      }
    } else {
      if (pendingBeepsQueue.current.length === 0 && 
          (now - lastBeepTimeRef.current >= MIN_BEEP_INTERVAL_MS * 0.4)) {
        pendingBeepsQueue.current.push({ time: now, value });
      
        if (!beepProcessorTimeoutRef.current) {
          beepProcessorTimeoutRef.current = window.setTimeout(
            () => processBeepQueue(
              isMonitoringRef, 
              lastSignalQualityRef, 
              consecutiveWeakSignalsRef, 
              MAX_CONSECUTIVE_WEAK_SIGNALS, 
              missedBeepsCounter, 
              playBeep
            ), 
            MIN_BEEP_INTERVAL_MS - (now - lastBeepTimeRef.current)
          );
        }
      }
    }
    
    return false;
  }, [MIN_BEEP_INTERVAL_MS, processBeepQueue]);

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

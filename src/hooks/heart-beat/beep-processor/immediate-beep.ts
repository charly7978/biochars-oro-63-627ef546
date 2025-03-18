
import { useCallback } from 'react';
import { BeepProcessorRefs, BeepProcessorConfig } from './types';

export function useImmediateBeep(
  refs: BeepProcessorRefs,
  config: BeepProcessorConfig,
  processBeepQueue: (
    isMonitoringRef: React.MutableRefObject<boolean>,
    lastSignalQualityRef: React.MutableRefObject<number>,
    consecutiveWeakSignalsRef: React.MutableRefObject<number>,
    MAX_CONSECUTIVE_WEAK_SIGNALS: number,
    missedBeepsCounter: React.MutableRefObject<number>,
    playBeep: (volume: number) => boolean | Promise<boolean>
  ) => void
) {
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
    
    // Only beep if signal quality is good and we don't have too many weak signals
    if (lastSignalQualityRef.current < 0.4 || 
        consecutiveWeakSignalsRef.current > MAX_CONSECUTIVE_WEAK_SIGNALS) {
      return false;
    }
    
    const now = Date.now();
    
    if (now - refs.lastBeepTimeRef.current >= config.MIN_BEEP_INTERVAL_MS) {
      try {
        const success = playBeep(0.7);
        
        if (success) {
          refs.lastBeepTimeRef.current = now;
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
      // Don't add too many beeps to the queue
      if (refs.pendingBeepsQueue.current.length < 3) {
        refs.pendingBeepsQueue.current.push({ time: now, value });
      
        if (!refs.beepProcessorTimeoutRef.current) {
          refs.beepProcessorTimeoutRef.current = window.setTimeout(
            () => processBeepQueue(
              isMonitoringRef, 
              lastSignalQualityRef, 
              consecutiveWeakSignalsRef, 
              MAX_CONSECUTIVE_WEAK_SIGNALS, 
              missedBeepsCounter, 
              playBeep
            ), 
            config.MIN_BEEP_INTERVAL_MS * 0.6
          );
        }
      }
    }
    
    return false;
  }, [refs, config, processBeepQueue]);

  return requestImmediateBeep;
}

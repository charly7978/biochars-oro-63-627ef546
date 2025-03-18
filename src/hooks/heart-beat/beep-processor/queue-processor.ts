
import { useCallback } from 'react';
import { BeepProcessorRefs, BeepProcessorConfig } from './types';

export function useBeepQueueProcessor(
  refs: BeepProcessorRefs,
  config: BeepProcessorConfig
) {
  const processBeepQueue = useCallback((
    isMonitoringRef: React.MutableRefObject<boolean>,
    lastSignalQualityRef: React.MutableRefObject<number>,
    consecutiveWeakSignalsRef: React.MutableRefObject<number>,
    MAX_CONSECUTIVE_WEAK_SIGNALS: number,
    missedBeepsCounter: React.MutableRefObject<number>,
    playBeep: (volume: number) => boolean | Promise<boolean>
  ) => {
    if (!isMonitoringRef.current) {
      // Clear the queue if not monitoring
      refs.pendingBeepsQueue.current = [];
      return;
    }
    
    if (refs.pendingBeepsQueue.current.length === 0) return;
    
    // Only process beeps if signal quality is good
    if (lastSignalQualityRef.current < 0.4) {
      refs.pendingBeepsQueue.current = [];
      return;
    }
    
    // Only process beeps if we haven't had too many weak signals
    if (consecutiveWeakSignalsRef.current > MAX_CONSECUTIVE_WEAK_SIGNALS) {
      refs.pendingBeepsQueue.current = [];
      return;
    }
    
    const now = Date.now();
    
    if (now - refs.lastBeepTimeRef.current >= config.MIN_BEEP_INTERVAL_MS) {
      try {
        // Attempt to play the beep only if monitoring
        if (isMonitoringRef.current) {
          playBeep(0.7); // Reduced volume
          refs.lastBeepTimeRef.current = now;
        }
        refs.pendingBeepsQueue.current.shift();
        missedBeepsCounter.current = 0; // Reset missed beeps counter
      } catch (err) {
        console.error('Error playing beep from queue:', err);
        refs.pendingBeepsQueue.current.shift(); // Remove failed beep and continue
      }
    }
    
    if (refs.pendingBeepsQueue.current.length > 0) {
      if (refs.beepProcessorTimeoutRef.current) {
        clearTimeout(refs.beepProcessorTimeoutRef.current);
      }
      refs.beepProcessorTimeoutRef.current = window.setTimeout(
        () => processBeepQueue(
          isMonitoringRef, 
          lastSignalQualityRef, 
          consecutiveWeakSignalsRef, 
          MAX_CONSECUTIVE_WEAK_SIGNALS, 
          missedBeepsCounter, 
          playBeep
        ), 
        config.MIN_BEEP_INTERVAL_MS * 0.5
      );
    }
  }, [refs, config]);

  return processBeepQueue;
}

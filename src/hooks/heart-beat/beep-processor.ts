
import { useState, useCallback, useRef } from 'react';

export function useBeepProcessor() {
  const pendingBeepsQueue = useRef<{time: number, value: number}[]>([]);
  const beepProcessorTimeoutRef = useRef<number | null>(null);
  const lastBeepTimeRef = useRef<number>(0);
  
  const MIN_BEEP_INTERVAL_MS = 200; // Reducido para más sensibilidad
  
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
      pendingBeepsQueue.current = [];
      return;
    }
    
    if (pendingBeepsQueue.current.length === 0) return;
    
    // Only process beeps if signal quality is good
    if (lastSignalQualityRef.current < 0.25) { // Reducido para mayor sensibilidad
      pendingBeepsQueue.current = [];
      return;
    }
    
    // Only process beeps if we haven't had too many weak signals
    if (consecutiveWeakSignalsRef.current > MAX_CONSECUTIVE_WEAK_SIGNALS) {
      pendingBeepsQueue.current = [];
      return;
    }
    
    const now = Date.now();
    
    if (now - lastBeepTimeRef.current >= MIN_BEEP_INTERVAL_MS) {
      try {
        // Attempt to play the beep only if monitoring
        if (isMonitoringRef.current) {
          console.log("BeepProcessor: Reproduciendo beep desde cola");
          playBeep(0.8); // Aumentado volumen
          lastBeepTimeRef.current = now;
        }
        pendingBeepsQueue.current.shift();
        missedBeepsCounter.current = 0; // Reset missed beeps counter
      } catch (err) {
        console.error('Error playing beep from queue:', err);
        pendingBeepsQueue.current.shift(); // Remove failed beep and continue
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
        MIN_BEEP_INTERVAL_MS * 0.4 // Más frecuente proceso
      );
    }
  }, []);

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
    
    // Solo beep si la calidad de señal es suficiente
    if (lastSignalQualityRef.current < 0.25 || // Reducido para mayor sensibilidad
        consecutiveWeakSignalsRef.current > MAX_CONSECUTIVE_WEAK_SIGNALS) {
      return false;
    }
    
    const now = Date.now();
    
    if (now - lastBeepTimeRef.current >= MIN_BEEP_INTERVAL_MS) {
      try {
        console.log("BeepProcessor: Intentando reproducir beep inmediato");
        const success = playBeep(Math.min(value * 1.2, 1.0)); // Aumentado volumen
        
        if (success) {
          console.log("BeepProcessor: Beep inmediato reproducido exitosamente");
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
      // Don't add too many beeps to the queue
      if (pendingBeepsQueue.current.length < 3) {
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
            MIN_BEEP_INTERVAL_MS * 0.4 // Más frecuente proceso
          );
        }
      }
    }
    
    return false;
  }, [processBeepQueue]);

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

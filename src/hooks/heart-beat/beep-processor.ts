
import { useCallback, useRef } from 'react';

export function useBeepProcessor() {
  const pendingBeepsQueue = useRef<{time: number, value: number}[]>([]);
  const beepProcessorTimeoutRef = useRef<number | null>(null);
  const lastBeepTimeRef = useRef<number>(0);
  
  const MIN_BEEP_INTERVAL_MS = 500;
  
  const processBeepQueue = useCallback((
    isMonitoringRef: React.MutableRefObject<boolean>,
    lastSignalQualityRef: React.MutableRefObject<number>,
    consecutiveWeakSignalsRef: React.MutableRefObject<number>,
    MAX_CONSECUTIVE_WEAK_SIGNALS: number,
    missedBeepsCounter: React.MutableRefObject<number>,
    playBeep: (volume: number) => boolean | Promise<boolean>
  ) => {
    if (pendingBeepsQueue.current.length === 0 || !isMonitoringRef.current) {
      return;
    }
    
    // Solo procesar si hay calidad suficiente de señal
    if (lastSignalQualityRef.current > 0.3 || 
        consecutiveWeakSignalsRef.current < MAX_CONSECUTIVE_WEAK_SIGNALS) {
      
      const now = Date.now();
      const beepToPlay = pendingBeepsQueue.current[0];
      
      // Solo reproducir si ha pasado suficiente tiempo desde el último beep
      if (now - lastBeepTimeRef.current >= MIN_BEEP_INTERVAL_MS) {
        playBeep(Math.min(0.8, beepToPlay.value + 0.2));
        lastBeepTimeRef.current = now;
        missedBeepsCounter.current = 0;
      } else {
        missedBeepsCounter.current++;
      }
      
      // Quitar el beep procesado de la cola
      pendingBeepsQueue.current.shift();
    }
    
    // Programar próximo procesamiento si hay más beeps en cola
    if (pendingBeepsQueue.current.length > 0 && isMonitoringRef.current) {
      beepProcessorTimeoutRef.current = window.setTimeout(() => {
        processBeepQueue(
          isMonitoringRef,
          lastSignalQualityRef,
          consecutiveWeakSignalsRef,
          MAX_CONSECUTIVE_WEAK_SIGNALS,
          missedBeepsCounter,
          playBeep
        );
      }, 50);
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
    if (!isMonitoringRef.current) {
      return false;
    }
    
    const now = Date.now();
    
    // Verificar si ha pasado suficiente tiempo desde el último beep
    if (now - lastBeepTimeRef.current < MIN_BEEP_INTERVAL_MS) {
      // Agregar a la cola para procesamiento posterior
      pendingBeepsQueue.current.push({ time: now, value });
      
      // Iniciar procesamiento de cola si no está en curso
      if (beepProcessorTimeoutRef.current === null) {
        beepProcessorTimeoutRef.current = window.setTimeout(() => {
          processBeepQueue(
            isMonitoringRef,
            lastSignalQualityRef,
            consecutiveWeakSignalsRef,
            MAX_CONSECUTIVE_WEAK_SIGNALS,
            missedBeepsCounter,
            playBeep
          );
        }, 50);
      }
      
      return false;
    }
    
    // Beep inmediato si la calidad de señal es buena
    if (lastSignalQualityRef.current > 0.3 || 
        consecutiveWeakSignalsRef.current < MAX_CONSECUTIVE_WEAK_SIGNALS) {
      
      const beepResult = playBeep(Math.min(0.8, value + 0.2));
      lastBeepTimeRef.current = now;
      missedBeepsCounter.current = 0;
      return !!beepResult;
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

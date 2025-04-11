
import { useState, useCallback, useRef } from 'react';

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
    // Todo el procesamiento de beeps ha sido eliminado
    // El sonido es manejado exclusivamente por PPGSignalMeter
    console.log("BeepProcessor: Completamente eliminado - sonido manejado exclusivamente por PPGSignalMeter");
    pendingBeepsQueue.current = []; // Vaciar cola
    return;
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
    // Todo el código de beep ha sido eliminado
    // El sonido es manejado exclusivamente por PPGSignalMeter
    console.log("BeepProcessor: Beep completamente eliminado - sonido manejado exclusivamente por PPGSignalMeter");
    return false;
  }, []);

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


import { useState, useCallback, useRef } from 'react';

export function useBeepProcessor() {
  const pendingBeepsQueue = useRef<{time: number, value: number, isArrhythmia?: boolean}[]>([]);
  const beepProcessorTimeoutRef = useRef<number | null>(null);
  const lastBeepTimeRef = useRef<number>(0);
  
  const MIN_BEEP_INTERVAL_MS = 300; // Ajustado para mejor sincronización con PPG
  
  const processBeepQueue = useCallback((
    isMonitoringRef: React.MutableRefObject<boolean>,
    lastSignalQualityRef: React.MutableRefObject<number>,
    consecutiveWeakSignalsRef: React.MutableRefObject<number>,
    MAX_CONSECUTIVE_WEAK_SIGNALS: number,
    missedBeepsCounter: React.MutableRefObject<number>,
    playBeep: (volume: number, isArrhythmia?: boolean) => boolean | Promise<boolean>
  ) => {
    // El procesamiento de beeps ha sido centralizado en useHeartbeatFeedback
    // Todo el sistema está sincronizado a través de PPGSignalMeter
    console.log("BeepProcessor: Sistema centralizado - toda la sincronización es manejada por PPGSignalMeter");
    pendingBeepsQueue.current = []; // Vaciar cola
    return;
  }, []);

  const requestImmediateBeep = useCallback((
    value: number,
    isArrhythmia: boolean = false,
    isMonitoringRef: React.MutableRefObject<boolean>,
    lastSignalQualityRef: React.MutableRefObject<number>,
    consecutiveWeakSignalsRef: React.MutableRefObject<number>,
    MAX_CONSECUTIVE_WEAK_SIGNALS: number,
    missedBeepsCounter: React.MutableRefObject<number>,
    playBeep: (volume: number, isArrhythmia?: boolean) => boolean | Promise<boolean>
  ): boolean => {
    // La función existe pero está redirigida al sistema central de sincronización
    const now = Date.now();
    if (now - lastBeepTimeRef.current < MIN_BEEP_INTERVAL_MS) {
      return false;
    }
    
    console.log("BeepProcessor: Beep solicitado redirigido al sistema central de sincronización", { 
      valor: value, 
      isArrhythmia, 
      tiempo: new Date(now).toISOString() 
    });
    
    lastBeepTimeRef.current = now;
    
    // Simplemente llamar al callback pero dejando la lógica principal en el sistema centralizado
    if (isMonitoringRef.current) {
      return playBeep(Math.abs(value), isArrhythmia);
    }
    
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

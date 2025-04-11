
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
    if (!isMonitoringRef.current || pendingBeepsQueue.current.length === 0) {
      return;
    }
    
    const now = Date.now();
    const timeSinceLastBeep = now - lastBeepTimeRef.current;
    
    if (timeSinceLastBeep < MIN_BEEP_INTERVAL_MS) {
      // Programar el siguiente procesamiento
      if (beepProcessorTimeoutRef.current === null) {
        beepProcessorTimeoutRef.current = window.setTimeout(() => {
          beepProcessorTimeoutRef.current = null;
          processBeepQueue(
            isMonitoringRef,
            lastSignalQualityRef,
            consecutiveWeakSignalsRef,
            MAX_CONSECUTIVE_WEAK_SIGNALS,
            missedBeepsCounter,
            playBeep
          );
        }, MIN_BEEP_INTERVAL_MS - timeSinceLastBeep + 10);
      }
      return;
    }
    
    // Obtener el beep más reciente y eliminar la cola
    const nextBeep = pendingBeepsQueue.current.shift();
    
    if (nextBeep) {
      // Calcular volumen basado en la calidad de señal
      let volume = Math.min(Math.max(lastSignalQualityRef.current, 0.1), 1.0);
      
      if (consecutiveWeakSignalsRef.current > MAX_CONSECUTIVE_WEAK_SIGNALS / 2) {
        volume *= 0.5; // Reducir volumen para señales débiles
      }
      
      // Reproducir beep con volumen ajustado
      playBeep(volume * 0.8);
      lastBeepTimeRef.current = now;
    }
    
    // Procesar siguientes beeps si quedan
    if (pendingBeepsQueue.current.length > 0) {
      if (beepProcessorTimeoutRef.current === null) {
        beepProcessorTimeoutRef.current = window.setTimeout(() => {
          beepProcessorTimeoutRef.current = null;
          processBeepQueue(
            isMonitoringRef,
            lastSignalQualityRef,
            consecutiveWeakSignalsRef,
            MAX_CONSECUTIVE_WEAK_SIGNALS,
            missedBeepsCounter,
            playBeep
          );
        }, MIN_BEEP_INTERVAL_MS);
      }
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
    if (!isMonitoringRef.current) {
      return false;
    }
    
    const now = Date.now();
    
    // Verificar si ha pasado suficiente tiempo desde el último beep
    if (now - lastBeepTimeRef.current < MIN_BEEP_INTERVAL_MS) {
      // Encolar para reproducción posterior
      pendingBeepsQueue.current.push({ time: now, value });
      
      // Iniciar procesamiento de la cola si no está en marcha
      if (beepProcessorTimeoutRef.current === null) {
        beepProcessorTimeoutRef.current = window.setTimeout(() => {
          beepProcessorTimeoutRef.current = null;
          processBeepQueue(
            isMonitoringRef,
            lastSignalQualityRef,
            consecutiveWeakSignalsRef,
            MAX_CONSECUTIVE_WEAK_SIGNALS,
            missedBeepsCounter,
            playBeep
          );
        }, MIN_BEEP_INTERVAL_MS - (now - lastBeepTimeRef.current) + 10);
      }
      
      return false;
    }
    
    // Calcular volumen basado en la calidad de señal
    let volume = Math.min(Math.max(lastSignalQualityRef.current, 0.1), 1.0);
    
    if (consecutiveWeakSignalsRef.current > MAX_CONSECUTIVE_WEAK_SIGNALS / 2) {
      volume *= 0.5; // Reducir volumen para señales débiles
    }
    
    // Reproducir beep inmediatamente
    playBeep(volume * 0.8);
    lastBeepTimeRef.current = now;
    
    return true;
  }, [processBeepQueue, MIN_BEEP_INTERVAL_MS]);

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

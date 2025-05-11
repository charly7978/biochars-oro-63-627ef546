
import { useRef, useCallback } from 'react';
import { AudioService } from '../../services/AudioService';

type BeepRequest = {
  timestamp: number;
  intensity: number;
  isArrhythmia: boolean;
};

export function useBeepProcessor() {
  const pendingBeepsQueue = useRef<BeepRequest[]>([]);
  const lastBeepTimeRef = useRef<number>(0);
  const beepProcessorTimeoutRef = useRef<number | null>(null);

  const requestImmediateBeep = useCallback((value: number): boolean => {
    try {
      const now = Date.now();
      const MIN_BEEP_INTERVAL = 250; // milisegundos
      
      // Evitar beeps demasiado frecuentes
      if (now - lastBeepTimeRef.current < MIN_BEEP_INTERVAL) {
        return false;
      }

      // Encolar la solicitud de beep
      pendingBeepsQueue.current.push({
        timestamp: now,
        intensity: Math.min(1.0, Math.abs(value) / 10),
        isArrhythmia: false
      });

      // Procesar inmediatamente si no hay procesamiento pendiente
      if (!beepProcessorTimeoutRef.current) {
        processBeepQueue();
      }
      
      return true;
    } catch (e) {
      console.error("Error solicitando beep:", e);
      return false;
    }
  }, []);

  const processBeepQueue = useCallback(() => {
    if (pendingBeepsQueue.current.length === 0) {
      beepProcessorTimeoutRef.current = null;
      return;
    }

    const now = Date.now();
    const MIN_BEEP_INTERVAL = 250; // milisegundos
    
    // Procesar el beep más antiguo primero
    const nextBeep = pendingBeepsQueue.current[0];
    
    if (now - lastBeepTimeRef.current >= MIN_BEEP_INTERVAL) {
      // Reproducir el beep con la intensidad correspondiente
      try {
        AudioService.playHeartbeatSound();
        lastBeepTimeRef.current = now;
      } catch (e) {
        console.error("Error reproduciendo beep:", e);
      }
      
      // Quitar el beep procesado de la cola
      pendingBeepsQueue.current.shift();
    }
    
    // Continuar procesando la cola
    if (pendingBeepsQueue.current.length > 0) {
      beepProcessorTimeoutRef.current = window.setTimeout(processBeepQueue, MIN_BEEP_INTERVAL);
    } else {
      beepProcessorTimeoutRef.current = null;
    }
  }, []);

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
}

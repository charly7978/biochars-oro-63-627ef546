
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useArrhythmiaDetector } from './heart-beat/arrhythmia-detector';
import HeartRateService from '@/services/HeartRateService';
import AudioFeedbackService from '@/services/AudioFeedbackService';
import { HeartRateResult } from '@/services/HeartRateService';

export interface UseHeartBeatReturn {
  currentBPM: number;
  confidence: number;
  processSignal: (value: number) => HeartRateResult;
  reset: () => void;
  isArrhythmia: boolean;
  requestBeep: (value: number) => boolean;
  startMonitoring: () => void;
  stopMonitoring: () => void;
}

export const useHeartBeatProcessor = (): UseHeartBeatReturn => {
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  const isMonitoringRef = useRef<boolean>(false);
  const initializedRef = useRef<boolean>(false);
  
  // Hooks para detección de arritmias (seguimos usando esto por compatibilidad)
  const {
    detectArrhythmia,
    lastRRIntervalsRef,
    currentBeatIsArrhythmiaRef,
    reset: resetArrhythmiaDetector
  } = useArrhythmiaDetector();

  useEffect(() => {
    console.log('useHeartBeatProcessor: Initializing processor', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    initializedRef.current = true;
    
    return () => {
      console.log('useHeartBeatProcessor: Cleaning up processor', {
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
    };
  }, []);

  // Función para solicitar beeps - mantenida por compatibilidad
  const requestBeep = useCallback((value: number): boolean => {
    if (!isMonitoringRef.current) {
      return false;
    }
    
    // Delegamos al servicio centralizado
    return AudioFeedbackService.triggerHeartbeatFeedback('normal', Math.min(0.8, value + 0.2));
  }, []);

  // Procesador de señal - ahora delegamos al servicio central
  const processSignal = useCallback((value: number): HeartRateResult => {
    if (!initializedRef.current) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: value,
        arrhythmiaCount: 0,
        rrIntervals: [],
        lastPeakTime: null
      };
    }

    // Usar el servicio central para procesar la señal
    const result = HeartRateService.processSignal(value);

    // Actualizar estado BPM y confianza si tenemos un buen resultado
    if (result.bpm > 0 && result.confidence > 0.4) {
      setCurrentBPM(result.bpm);
      setConfidence(result.confidence);
      
      // Actualizar RR intervals para la detección de arritmias heredada
      if (result.rrIntervals && result.rrIntervals.length > 0) {
        lastRRIntervalsRef.current = [...result.rrIntervals];
      }
    }

    return result;
  }, []);

  // Reset del procesador
  const reset = useCallback(() => {
    console.log('useHeartBeatProcessor: Resetting processor', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    // Reiniciar el servicio centralizado
    HeartRateService.reset();
    
    setCurrentBPM(0);
    setConfidence(0);
    
    resetArrhythmiaDetector();
  }, [resetArrhythmiaDetector]);

  // Iniciar monitoreo
  const startMonitoring = useCallback(() => {
    console.log('useHeartBeatProcessor: Starting monitoring');
    isMonitoringRef.current = true;
    HeartRateService.setMonitoring(true);
  }, []);

  // Detener monitoreo
  const stopMonitoring = useCallback(() => {
    console.log('useHeartBeatProcessor: Stopping monitoring');
    isMonitoringRef.current = false;
    HeartRateService.setMonitoring(false);
    
    setCurrentBPM(0);
    setConfidence(0);
  }, []);

  return {
    currentBPM,
    confidence,
    processSignal,
    reset,
    isArrhythmia: currentBeatIsArrhythmiaRef.current,
    requestBeep,
    startMonitoring,
    stopMonitoring
  };
};

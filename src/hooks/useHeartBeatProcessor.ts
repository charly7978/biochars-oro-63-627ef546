import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
// import { useArrhythmiaDetector } from './heart-beat/arrhythmia-detector'; // Eliminado
import HeartRateService from '@/services/HeartRateService';
import AudioFeedbackService from '@/services/AudioFeedbackService';
import ArrhythmiaDetectionService, { ArrhythmiaDetectionResult } from '@/services/ArrhythmiaDetectionService'; // Importado
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
  // Podríamos añadir más datos de arritmia si fueran necesarios
  arrhythmiaCategory?: ArrhythmiaDetectionResult['category'];
}

export const useHeartBeatProcessor = (): UseHeartBeatReturn => {
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  const isMonitoringRef = useRef<boolean>(false);
  const initializedRef = useRef<boolean>(false);
  
  // Estado/Ref para resultado de arritmia del servicio centralizado
  const isArrhythmiaRef = useRef<boolean>(false);
  const arrhythmiaCategoryRef = useRef<ArrhythmiaDetectionResult['category']>('normal');

  // // Hooks para detección de arritmias heredado - ELIMINADO
  // const {
  //   detectArrhythmia,
  //   lastRRIntervalsRef,
  //   currentBeatIsArrhythmiaRef,
  //   reset: resetArrhythmiaDetector
  // } = useArrhythmiaDetector();

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
    
    // Podríamos pasar el estado real de arritmia si es necesario
    return AudioFeedbackService.triggerHeartbeatFeedback(isArrhythmiaRef.current ? 'arrhythmia' : 'normal', Math.min(0.8, value + 0.2));
  }, []);

  // Procesador de señal - ahora integra ArrhythmiaDetectionService
  const processSignal = useCallback((value: number): HeartRateResult => {
    if (!initializedRef.current) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: value,
        rrIntervals: [],
        lastPeakTime: null
      };
    }

    // 1. Usar el servicio central de HR para obtener BPM, confianza, RR, etc.
    const hrResult = HeartRateService.processSignal(value);

    // 2. Si hay datos RR, llamar al servicio central de arritmia
    let arrhythmiaResult: ArrhythmiaDetectionResult | null = null;
    if (hrResult.rrData?.intervals && hrResult.rrData.intervals.length > 0) {
      arrhythmiaResult = ArrhythmiaDetectionService.detectArrhythmia(hrResult.rrData.intervals);
      // Actualizar estado interno de arritmia
      isArrhythmiaRef.current = arrhythmiaResult.isArrhythmia;
      arrhythmiaCategoryRef.current = arrhythmiaResult.category || 'normal';
    } else {
       // Si no hay datos RR, asumir que no hay arritmia detectada en este ciclo
       isArrhythmiaRef.current = false;
       arrhythmiaCategoryRef.current = 'normal';
    }

    // Actualizar estado BPM y confianza si tenemos un buen resultado
    if (hrResult.bpm > 0 && hrResult.confidence > 0.4) {
      setCurrentBPM(hrResult.bpm);
      setConfidence(hrResult.confidence);
    }
    
    // Devolver el resultado original de HeartRateService (ya no contiene isArrhythmia propio)
    return hrResult; 

  }, []); // Fin de processSignal

  // Reset del procesador
  const reset = useCallback(() => {
    console.log('useHeartBeatProcessor: Resetting processor', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    // Reiniciar servicios centralizados
    HeartRateService.reset();
    ArrhythmiaDetectionService.reset(); // Añadir reset del servicio de arritmia
    
    setCurrentBPM(0);
    setConfidence(0);
    isArrhythmiaRef.current = false; // Resetear estado interno
    arrhythmiaCategoryRef.current = 'normal';
    
    // resetArrhythmiaDetector(); // Llamada eliminada
  }, []);

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
    isArrhythmiaRef.current = false; // Resetear al detener
    arrhythmiaCategoryRef.current = 'normal';
  }, []);

  return {
    currentBPM,
    confidence,
    processSignal,
    reset,
    isArrhythmia: isArrhythmiaRef.current, // Usar el estado del servicio centralizado
    arrhythmiaCategory: arrhythmiaCategoryRef.current, // Exponer categoría
    requestBeep,
    startMonitoring,
    stopMonitoring
  };
};


import { useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../../modules/HeartBeatProcessor';
import { HeartBeatResult } from './types';

export const useSignalProcessor = () => {
  // Referencias para el seguimiento del estado
  const lastPeakTimeRef = useRef<number | null>(null);
  const lastValidBpmRef = useRef<number>(0);
  const lastSignalQualityRef = useRef<number>(0);
  const consecutiveWeakSignalsRef = useRef<number>(0);
  
  // Constantes de configuración
  const MAX_CONSECUTIVE_WEAK_SIGNALS = 5;
  const MIN_SIGNAL_QUALITY = 0.3;
  
  // Función para procesar la señal y detectar picos
  const processSignal = useCallback((
    value: number,
    currentBpm: number,
    confidence: number,
    processor: HeartBeatProcessor,
    requestBeep: (value: number) => boolean,
    isMonitoringRef: React.RefObject<boolean>,
    lastPeakTime: number | null, // Ahora recibe el valor directamente, no la referencia
    lastValidBpmRef: React.RefObject<number>
  ): HeartBeatResult => {
    if (!isMonitoringRef.current || !processor) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        isArrhythmia: false,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      };
    }
    
    // Procesamos la señal con el procesador de latidos
    const result = processor.processSignal(value);
    
    // Actualizamos lastPeakTimeRef si se detectó un pico
    if (result.isPeak) {
      lastPeakTimeRef.current = Date.now();
    }
    
    // Si tenemos un buen nivel de confianza, actualizamos el último BPM válido
    if (result.bpm > 40 && result.bpm < 200 && result.confidence > 0.5) {
      lastValidBpmRef.current = result.bpm;
    }
    
    // Actualizamos la calidad de la señal
    lastSignalQualityRef.current = Math.max(0, Math.min(1, confidence));
    
    // Gestionamos los contadores de señales débiles
    if (confidence < MIN_SIGNAL_QUALITY) {
      consecutiveWeakSignalsRef.current++;
    } else {
      consecutiveWeakSignalsRef.current = 0;
    }
    
    return result;
  }, []);
  
  // Función para resetear el procesador
  const reset = useCallback(() => {
    lastPeakTimeRef.current = null;
    lastValidBpmRef.current = 0;
    lastSignalQualityRef.current = 0;
    consecutiveWeakSignalsRef.current = 0;
  }, []);
  
  return {
    processSignal,
    reset,
    lastPeakTimeRef,
    lastValidBpmRef,
    lastSignalQualityRef,
    consecutiveWeakSignalsRef,
    MAX_CONSECUTIVE_WEAK_SIGNALS
  };
};

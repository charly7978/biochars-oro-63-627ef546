
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Adaptador para mantener compatibilidad con useHeartBeatProcessor
 */

import { useState, useRef, useCallback } from 'react';
import { UnifiedSignalProcessor } from '../../modules/signal-processing/unified/UnifiedSignalProcessor';

/**
 * Hook adaptador que utiliza el procesador unificado pero mantiene
 * la interfaz del useHeartBeatProcessor original
 */
export function useUnifiedHeartBeatAdapter() {
  const processorRef = useRef<UnifiedSignalProcessor | null>(null);
  const [currentBPM, setCurrentBPM] = useState(0);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const lastRRIntervalsRef = useRef<number[]>([]);
  const currentBeatIsArrhythmiaRef = useRef<boolean>(false);
  
  /**
   * Procesa un valor de señal y devuelve un resultado de latido
   */
  const processSignal = useCallback((value: number) => {
    if (!processorRef.current) {
      // Crear procesador bajo demanda
      processorRef.current = new UnifiedSignalProcessor();
    }
    
    // Procesar señal con el procesador unificado
    const result = processorRef.current.processSignal(value);
    
    // Actualizar BPM si hay uno válido
    if (result.instantaneousBPM && result.instantaneousBPM > 40 && result.instantaneousBPM < 200) {
      setCurrentBPM(Math.round(result.instantaneousBPM));
    }
    
    // Actualizar intervalos RR
    const rrData = processorRef.current.getRRIntervals();
    if (rrData.intervals.length > 0) {
      lastRRIntervalsRef.current = [...rrData.intervals];
    }
    
    // Arrhythmia detection
    if (result.isPeak) {
      currentBeatIsArrhythmiaRef.current = rrData.intervals.length >= 3 && 
        processorRef.current.getArrhythmiaCounter() > 0;
    }
    
    // Construir resultado compatible
    return {
      bpm: currentBPM,
      confidence: result.peakConfidence,
      isPeak: result.isPeak,
      arrhythmiaCount: processorRef.current.getArrhythmiaCounter(),
      rrData: {
        intervals: lastRRIntervalsRef.current,
        lastPeakTime: rrData.lastPeakTime
      }
    };
  }, [currentBPM]);
  
  /**
   * Inicia el monitoreo
   */
  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
    if (!processorRef.current) {
      processorRef.current = new UnifiedSignalProcessor();
    }
  }, []);
  
  /**
   * Detiene el monitoreo
   */
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    if (processorRef.current) {
      processorRef.current.reset();
    }
    setCurrentBPM(0);
  }, []);
  
  /**
   * Reinicia completamente el procesador
   */
  const reset = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.fullReset();
    }
    setCurrentBPM(0);
    lastRRIntervalsRef.current = [];
    currentBeatIsArrhythmiaRef.current = false;
    setIsMonitoring(false);
  }, []);
  
  /**
   * Verifica si hay arrhythmia
   */
  const isArrhythmia = useCallback(() => {
    return currentBeatIsArrhythmiaRef.current;
  }, []);
  
  return {
    processSignal,
    startMonitoring,
    stopMonitoring,
    reset,
    isArrhythmia,
    currentBPM,
    isMonitoring,
    arrhythmiaCount: processorRef.current?.getArrhythmiaCounter() || 0
  };
}

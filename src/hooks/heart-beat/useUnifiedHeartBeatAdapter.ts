
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Adaptador para mantener compatibilidad con useHeartBeatProcessor
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { UnifiedSignalProcessor } from '../../modules/signal-processing/unified/UnifiedSignalProcessor';
import { HeartBeatResult } from './types';

/**
 * Hook adaptador que utiliza el procesador unificado pero mantiene 
 * la interfaz del useHeartBeatProcessor original
 */
export const useUnifiedHeartBeatAdapter = () => {
  // Procesador unificado
  const processorRef = useRef<UnifiedSignalProcessor | null>(null);
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  // Referencias de estado
  const isMonitoringRef = useRef<boolean>(false);
  const currentBeatIsArrhythmiaRef = useRef<boolean>(false);
  const lastRRIntervalsRef = useRef<number[]>([]);
  
  // Inicializar procesador
  useEffect(() => {
    console.log('useUnifiedHeartBeatAdapter: Initializing new processor', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    try {
      if (!processorRef.current) {
        processorRef.current = new UnifiedSignalProcessor();
        console.log('UnifiedSignalProcessor: New instance created');
        
        if (typeof window !== 'undefined') {
          (window as any).unifiedProcessor = processorRef.current;
        }
      }
    } catch (error) {
      console.error('Error initializing UnifiedSignalProcessor:', error);
    }

    return () => {
      console.log('useUnifiedHeartBeatAdapter: Cleaning up processor', {
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
      
      if (processorRef.current) {
        processorRef.current.reset();
        processorRef.current = null;
      }
      
      if (typeof window !== 'undefined') {
        (window as any).unifiedProcessor = undefined;
      }
    };
  }, []);
  
  /**
   * Procesa una señal y devuelve resultados en el formato
   * compatible con useHeartBeatProcessor
   */
  const processSignal = useCallback((value: number): HeartBeatResult => {
    if (!processorRef.current) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        arrhythmiaCount: 0,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      };
    }

    // Procesar con procesador unificado
    const result = processorRef.current.processSignal(value);
    
    // Actualizar estado
    if (result.instantaneousBPM && result.instantaneousBPM > 0 && result.peakConfidence > 0.4) {
      setCurrentBPM(result.instantaneousBPM);
      setConfidence(result.peakConfidence);
    }
    
    // Datos RR
    if (result.rrInterval) {
      const rrIntervals = processorRef.current.getRRIntervals().intervals;
      lastRRIntervalsRef.current = [...rrIntervals];
      
      // Verificar arritmia
      if (rrIntervals.length >= 3) {
        const lastThree = rrIntervals.slice(-3);
        const avg = lastThree.reduce((sum, val) => sum + val, 0) / lastThree.length;
        const variations = lastThree.map(interval => Math.abs(interval - avg) / avg);
        
        currentBeatIsArrhythmiaRef.current = variations.some(variation => variation > 0.2);
      }
    }
    
    // Crear resultado en formato compatible
    return {
      bpm: result.instantaneousBPM || currentBPM,
      confidence: result.peakConfidence,
      isPeak: result.isPeak,
      arrhythmiaCount: result.arrhythmiaCount,
      isArrhythmia: currentBeatIsArrhythmiaRef.current,
      rrData: {
        intervals: lastRRIntervalsRef.current,
        lastPeakTime: result.isPeak ? result.timestamp : null
      }
    };
  }, [currentBPM]);
  
  /**
   * Reinicia el procesador
   */
  const reset = useCallback(() => {
    console.log('useUnifiedHeartBeatAdapter: Resetting processor', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    if (processorRef.current) {
      processorRef.current.reset();
      isMonitoringRef.current = false;
    }
    
    setCurrentBPM(0);
    setConfidence(0);
    
    lastRRIntervalsRef.current = [];
    currentBeatIsArrhythmiaRef.current = false;
  }, []);
  
  /**
   * Inicia monitoreo
   */
  const startMonitoring = useCallback(() => {
    console.log('useUnifiedHeartBeatAdapter: Starting monitoring');
    if (processorRef.current) {
      isMonitoringRef.current = true;
    }
  }, []);
  
  /**
   * Detiene monitoreo
   */
  const stopMonitoring = useCallback(() => {
    console.log('useUnifiedHeartBeatAdapter: Stopping monitoring');
    if (processorRef.current) {
      isMonitoringRef.current = false;
    }
    
    setCurrentBPM(0);
    setConfidence(0);
  }, []);
  
  /**
   * Solicita un beep (función ficticia para compatibilidad)
   */
  const requestBeep = useCallback((): boolean => {
    return false;
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

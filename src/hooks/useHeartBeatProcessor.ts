
/**
 * Hook para procesamiento de latidos cardíacos
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { HeartbeatProcessor } from '../modules/signal-processing/heartbeat-processor';
import { useArrhythmiaDetector } from './heart-beat/arrhythmia-detector';

/**
 * Hook que procesa señales PPG para detectar latidos y calcular BPM
 */
export const useHeartBeatProcessor = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [heartRate, setHeartRate] = useState(0);
  const [isArrhythmia, setIsArrhythmia] = useState(false);
  const heartbeatProcessor = useRef<HeartbeatProcessor>(new HeartbeatProcessor());
  const { 
    detectArrhythmia, 
    reset: resetArrhythmiaDetector 
  } = useArrhythmiaDetector();
  
  const rrIntervalsRef = useRef<number[]>([]);
  const lastPeakTimeRef = useRef<number | null>(null);
  const peakHistoryRef = useRef<{time: number, value: number}[]>([]);
  const arrhythmiaDetectedRef = useRef(false);
  
  // Inicializar procesador al montar componente
  useEffect(() => {
    heartbeatProcessor.current.initialize();
    
    return () => {
      heartbeatProcessor.current.reset();
    };
  }, []);
  
  /**
   * Inicia el monitoreo de latidos
   */
  const startMonitoring = useCallback(() => {
    console.log("HeartBeatProcessor: Iniciando monitoreo");
    setIsMonitoring(true);
    heartbeatProcessor.current.start();
  }, []);
  
  /**
   * Detiene el monitoreo de latidos
   */
  const stopMonitoring = useCallback(() => {
    console.log("HeartBeatProcessor: Deteniendo monitoreo");
    setIsMonitoring(false);
    heartbeatProcessor.current.stop();
  }, []);
  
  /**
   * Procesa un valor PPG para detectar latidos
   */
  const processSignal = useCallback((value: number) => {
    if (!isMonitoring) {
      return { bpm: 0, rrData: null, confidence: 0 };
    }
    
    // Procesar valor a través del detector de latidos
    const result = heartbeatProcessor.current.processSignal(value);
    
    // Si no hay procesamiento válido, retornar resultado vacío
    if (!result.metadata) {
      return { 
        bpm: 0, 
        rrData: {
          intervals: [],
          lastPeakTime: null
        }, 
        confidence: 0,
        isArrhythmia: false 
      };
    }
    
    // Actualizar datos de intervalos RR
    if (result.metadata.rrIntervals) {
      rrIntervalsRef.current = result.metadata.rrIntervals;
    }
    
    if (result.metadata.lastPeakTime) {
      lastPeakTimeRef.current = result.metadata.lastPeakTime;
    }
    
    // Actualizar BPM
    const bpm = result.metadata.bpm || 0;
    if (bpm > 0) {
      setHeartRate(bpm);
    }
    
    // Registrar pico si se detectó uno
    if (result.isPeak) {
      peakHistoryRef.current.push({
        time: result.timestamp,
        value: result.filteredValue
      });
      
      // Mantener historial limitado
      if (peakHistoryRef.current.length > 20) {
        peakHistoryRef.current.shift();
      }
    }
    
    // Detectar arritmias si hay suficientes intervalos
    let arrhythmiaDetected = false;
    if (rrIntervalsRef.current.length >= 5 && bpm > 40) {
      const arrhythmiaResult = detectArrhythmia(rrIntervalsRef.current);
      arrhythmiaDetected = arrhythmiaResult.isArrhythmia;
      
      // Solo actualizar el estado si cambia para evitar rerenders innecesarios
      if (arrhythmiaDetected !== arrhythmiaDetectedRef.current) {
        setIsArrhythmia(arrhythmiaDetected);
        arrhythmiaDetectedRef.current = arrhythmiaDetected;
        
        if (arrhythmiaDetected) {
          console.log("HeartBeatProcessor: Arritmia detectada en useHeartBeatProcessor");
        }
      }
    }
    
    // Calcular confianza basada en calidad de señal y cantidad de intervalos
    let confidence = 0;
    if (result.quality > 60 && rrIntervalsRef.current.length > 5) {
      confidence = 0.8;
    } else if (result.quality > 40 && rrIntervalsRef.current.length > 3) {
      confidence = 0.5;
    } else if (rrIntervalsRef.current.length > 0) {
      confidence = 0.3;
    }
    
    return {
      bpm,
      rrData: {
        intervals: rrIntervalsRef.current,
        lastPeakTime: lastPeakTimeRef.current
      },
      confidence,
      peaks: peakHistoryRef.current,
      isArrhythmia: arrhythmiaDetected
    };
  }, [isMonitoring, detectArrhythmia]);
  
  /**
   * Reinicia el procesador
   */
  const reset = useCallback(() => {
    console.log("HeartBeatProcessor: Reseteando");
    heartbeatProcessor.current.reset();
    resetArrhythmiaDetector();
    rrIntervalsRef.current = [];
    lastPeakTimeRef.current = null;
    peakHistoryRef.current = [];
    arrhythmiaDetectedRef.current = false;
    setHeartRate(0);
    setIsArrhythmia(false);
  }, [resetArrhythmiaDetector]);
  
  return {
    processSignal,
    heartRate,
    isArrhythmia,
    startMonitoring,
    stopMonitoring,
    reset
  };
};

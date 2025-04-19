
import { useState, useEffect, useRef, useCallback } from 'react';
import { HeartBeatProcessor } from '../../modules/HeartBeatProcessor';
import { HeartBeatResult } from '@/core/types';
import { AudioService } from '../../services/AudioService';
import { useArrhythmiaDetector } from './arrhythmia-detector'; // Importando hook arrhythmia detector

/**
 * Hook para el procesamiento de la frecuencia cardíaca a partir de señales PPG reales
 * No se permite ninguna simulación o datos sintéticos
 */
export const useHeartBeatProcessor = () => {
  const [heartBeatResult, setHeartBeatResult] = useState<HeartBeatResult>({
    bpm: 0,
    confidence: 0,
    isPeak: false,
    arrhythmiaCount: 0,
    rrData: { intervals: [], lastPeakTime: null }
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isArrhythmia, setIsArrhythmia] = useState(false);
  const [ppgData, setPpgData] = useState<number[]>([]);
  
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const isMonitoringRef = useRef<boolean>(false);
  const lastBpmRef = useRef<number>(0);
  const lastRRIntervalsRef = useRef<number[]>([]);
  const currentBeatIsArrhythmiaRef = useRef<boolean>(false);

  // Arrhythmia detector hook to analyze RR intervals
  const {
    detectArrhythmia,
    lastRRIntervalsRef: arrhythmiaRRRef,
    reset: resetArrhythmiaDetector
  } = useArrhythmiaDetector();

  // Inicializar el procesador una sola vez
  useEffect(() => {
    if (!processorRef.current) {
      console.log("useHeartBeatProcessor: Inicializando detector de frecuencia cardíaca");
      processorRef.current = new HeartBeatProcessor();

      if (typeof window !== 'undefined') {
        window.heartBeatProcessor = processorRef.current;
      }
    }
  }, []);

  /**
   * Procesa la señal PPG y devuelve resultados de frecuencia cardíaca
   * Solo utiliza datos reales
   */
  const processSignal = useCallback((value: number) => {
    if (!processorRef.current || !isMonitoringRef.current) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: value,
        arrhythmiaCount: 0,
        rrData: { intervals: [], lastPeakTime: null },
        isArrhythmia: false
      };
    }
  
    setPpgData(prevData => {
      const newData = [...prevData, value];
      if (newData.length > 150) {
        return newData.slice(-150);
      }
      return newData;
    });

    try {
      // Process the signal properly with correct function signature
      // processSignal only accepts 1 argument: value
      const result = processorRef.current.processSignal(value);

      // Get RR intervals from processor
      const rrData = processorRef.current.getRRIntervals();

      // Update references RR for arrhythmia detector
      if (rrData && rrData.intervals) {
        arrhythmiaRRRef.current = rrData.intervals;
      }

      // Ejecución de la detección de arritmia con datos reales
      const arrhythmiaDetection = detectArrhythmia(arrhythmiaRRRef.current);

      // Marcar si hay arritmia detectada
      currentBeatIsArrhythmiaRef.current = arrhythmiaDetection.isArrhythmia;

      setIsArrhythmia(arrhythmiaDetection.isArrhythmia);

      // Añadir contador de arritmias al resultado para visibilidad externa
      const updatedArrhythmiaCount = arrhythmiaDetection.isArrhythmia ? (heartBeatResult.arrhythmiaCount + 1) : heartBeatResult.arrhythmiaCount;

      const updatedResult: HeartBeatResult = {
        ...result,
        arrhythmiaCount: updatedArrhythmiaCount,
        isArrhythmia: arrhythmiaDetection.isArrhythmia,
        rrData: {
          intervals: rrData.intervals,
          lastPeakTime: rrData.lastPeakTime
        }
      };

      lastBpmRef.current = result.bpm || lastBpmRef.current;
      setHeartBeatResult(updatedResult);

      return {
        ...updatedResult,
        filteredValue: value,
        rrData: {
          intervals: rrData.intervals,
          lastPeakTime: rrData.lastPeakTime
        }
      };
    } catch (e) {
      console.error("useHeartBeatProcessor: Error procesando señal", e);

      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: value,
        arrhythmiaCount: 0,
        rrData: { intervals: [], lastPeakTime: null },
        isArrhythmia: false
      };
    }
  }, [detectArrhythmia, heartBeatResult.arrhythmiaCount, arrhythmiaRRRef]);

  /**
   * Inicia el monitoreo de frecuencia cardíaca
   */
  const startMonitoring = useCallback(() => {
    console.log("useHeartBeatProcessor: Iniciando monitoreo");
    setIsProcessing(true);
    isMonitoringRef.current = true;
    
    if (processorRef.current) {
      processorRef.current.reset();
    }
    
    resetArrhythmiaDetector(); // Reset detector arritmia al iniciar
  
    setHeartBeatResult({
      bpm: 0,
      confidence: 0,
      isPeak: false,
      arrhythmiaCount: 0,
      rrData: { intervals: [], lastPeakTime: null }
    });
    
    setPpgData([]);
  }, [resetArrhythmiaDetector]);

  /**
   * Detiene el monitoreo de frecuencia cardíaca
   */
  const stopMonitoring = useCallback(() => {
    console.log("useHeartBeatProcessor: Deteniendo monitoreo");
    setIsProcessing(false);
    isMonitoringRef.current = false;
  }, []);

  /**
   * Reinicia el procesador de frecuencia cardíaca
   */
  const reset = useCallback(() => {
    console.log("useHeartBeatProcessor: Reiniciando procesador");
    
    if (processorRef.current) {
      processorRef.current.reset();
    }
    
    resetArrhythmiaDetector();

    lastBpmRef.current = 0;
    lastRRIntervalsRef.current = [];
    currentBeatIsArrhythmiaRef.current = false;

    setHeartBeatResult({
      bpm: 0,
      confidence: 0,
      isPeak: false,
      arrhythmiaCount: 0,
      rrData: { intervals: [], lastPeakTime: null }
    });

    setPpgData([]);
    setIsArrhythmia(false);
  }, [resetArrhythmiaDetector]);


  /**
   * Función de retroalimentación para pulsos cardíacos
   * Utiliza AudioService para señales auditivas
   */
  const requestImmediateBeep = useCallback((value: number) => {
    if (!isMonitoringRef.current) return false;
    
    try {
      if (heartBeatResult.bpm > 40 && value > 0.2) {
        AudioService.playHeartbeatSound();
        return true;
      }
    } catch (e) {
      console.error("Error reproduciendo sonido", e);
    }
    
    return false;
  }, [heartBeatResult.bpm]);

  return {
    heartBeatResult,
    isProcessing,
    startProcessing: startMonitoring,
    stopProcessing: stopMonitoring,
    processSignal,
    reset,
    isArrhythmia,
    startMonitoring,
    stopMonitoring,
    lastBpm: lastBpmRef.current,
    hasBpmData: lastBpmRef.current > 0,
    isMonitoring: isMonitoringRef.current,
    ppgData
  };
};


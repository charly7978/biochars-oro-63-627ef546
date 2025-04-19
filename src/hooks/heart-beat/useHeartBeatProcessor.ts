
import { useState, useEffect, useRef, useCallback } from 'react';
import { HeartBeatProcessor } from '../../modules/HeartBeatProcessor';
import { HeartBeatResult } from '@/core/types';
import { AudioService } from '../../services/AudioService';
import { useSignalProcessor } from './signal-processor';

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
  
  const { 
    processSignal: processorFunc, 
    reset: resetProcessor,
    lastPeakTimeRef,
    lastValidBpmRef
  } = useSignalProcessor();

  // Inicializar el procesador una sola vez
  useEffect(() => {
    if (!processorRef.current) {
      console.log("useHeartBeatProcessor: Inicializando detector de frecuencia cardíaca");
      processorRef.current = new HeartBeatProcessor();
      
      // Registrar a nivel global para debug si es necesario
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
        rrData: { intervals: [], lastPeakTime: null }
      };
    }
    
    // Actualizar datos para visualización
    setPpgData(prevData => {
      const newData = [...prevData, value];
      if (newData.length > 150) {
        return newData.slice(-150);
      }
      return newData;
    });
    
    try {
      // Procesamiento real de la señal PPG (sin simulaciones)
      const result = processorFunc(
        value,
        lastBpmRef.current,
        heartBeatResult.confidence,
        processorRef.current,
        requestImmediateBeep,
        isMonitoringRef,
        lastRRIntervalsRef,
        currentBeatIsArrhythmiaRef
      );
      
      // Actualizar resultado y referencias
      lastBpmRef.current = result.bpm || lastBpmRef.current;
      setHeartBeatResult(result);
      
      // Verificar arritmia
      if (result.isArrhythmia) {
        setIsArrhythmia(true);
        setTimeout(() => setIsArrhythmia(false), 1500);
      }
      
      return {
        ...result,
        filteredValue: value,
        rrData: {
          intervals: lastRRIntervalsRef.current,
          lastPeakTime: lastPeakTimeRef.current
        }
      };
    } catch (e) {
      console.error("useHeartBeatProcessor: Error procesando señal", e);
      return {
        bpm: lastBpmRef.current || 0,
        confidence: 0,
        isPeak: false,
        filteredValue: value,
        arrhythmiaCount: processorRef.current.getArrhythmiaCounter(),
        rrData: { intervals: [], lastPeakTime: null }
      };
    }
  }, [processorFunc, heartBeatResult.confidence, lastPeakTimeRef]);

  /**
   * Inicia el monitoreo de frecuencia cardíaca
   */
  const startMonitoring = useCallback(() => {
    console.log("useHeartBeatProcessor: Iniciando monitoreo");
    setIsProcessing(true);
    isMonitoringRef.current = true;
    resetProcessor();
    setHeartBeatResult({
      bpm: 0,
      confidence: 0,
      isPeak: false,
      arrhythmiaCount: 0,
      rrData: { intervals: [], lastPeakTime: null }
    });
    setPpgData([]);
  }, [resetProcessor]);

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
    
    resetProcessor();
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
  }, [resetProcessor]);

  /**
   * Función de retroalimentación para pulsos cardíacos
   * Utiliza AudioService para señales auditivas
   */
  const requestImmediateBeep = useCallback((value: number) => {
    if (!isMonitoringRef.current) return false;
    
    try {
      // Solo reproducir sonido si estamos procesando y tenemos buena calidad
      if (lastValidBpmRef.current > 40 && value > 0.2) {
        AudioService.playHeartbeatSound();
        return true;
      }
    } catch (e) {
      console.error("Error reproduciendo sonido", e);
    }
    
    return false;
  }, [lastValidBpmRef]);

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
    lastValidBpm: lastValidBpmRef.current,
    hasBpmData: lastValidBpmRef.current > 0,
    isMonitoring: isMonitoringRef.current,
    ppgData
  };
};

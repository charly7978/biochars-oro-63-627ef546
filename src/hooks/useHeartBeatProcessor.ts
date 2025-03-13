
import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';

interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  filteredValue?: number;
  arrhythmiaCount: number;
  rrData?: {
    intervals: number[];
    lastPeakTime: number | null;
  };
  detectedPeaks?: {timestamp: number, value: number}[];
}

export const useHeartBeatProcessor = () => {
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const processingStatsRef = useRef<{
    latency: number;
    peakTimestamps: number[];
  }>({
    latency: 0,
    peakTimestamps: []
  });

  useEffect(() => {
    console.log('useHeartBeatProcessor: Creando nueva instancia de HeartBeatProcessor', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    processorRef.current = new HeartBeatProcessor();
    
    if (typeof window !== 'undefined') {
      (window as any).heartBeatProcessor = processorRef.current;
      console.log('useHeartBeatProcessor: Processor registrado en window', {
        processorRegistrado: !!(window as any).heartBeatProcessor,
        timestamp: new Date().toISOString()
      });
    }

    return () => {
      console.log('useHeartBeatProcessor: Limpiando processor', {
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
      
      if (processorRef.current) {
        processorRef.current = null;
      }
      
      if (typeof window !== 'undefined') {
        (window as any).heartBeatProcessor = undefined;
        console.log('useHeartBeatProcessor: Processor eliminado de window', {
          processorExiste: !!(window as any).heartBeatProcessor,
          timestamp: new Date().toISOString()
        });
      }
    };
  }, []);

  const processSignal = useCallback((value: number): HeartBeatResult => {
    if (!processorRef.current) {
      console.warn('useHeartBeatProcessor: Processor no inicializado', {
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
      
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        arrhythmiaCount: 0,
        rrData: {
          intervals: [],
          lastPeakTime: null
        },
        detectedPeaks: []
      };
    }

    console.log('useHeartBeatProcessor - processSignal detallado:', {
      inputValue: value,
      normalizadoValue: value.toFixed(2),
      currentProcessor: !!processorRef.current,
      processorMethods: processorRef.current ? Object.getOwnPropertyNames(Object.getPrototypeOf(processorRef.current)) : [],
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });

    const result = processorRef.current.processSignal(value);
    const rrData = processorRef.current.getRRIntervals();
    const processingStats = processorRef.current.getProcessingStats();
    
    // Actualizar estadísticas de procesamiento para sincronización
    processingStatsRef.current.latency = processingStats.latency;
    
    if (result.isPeak) {
      processingStatsRef.current.peakTimestamps.push(Date.now());
      // Mantener solo los últimos 10 picos
      if (processingStatsRef.current.peakTimestamps.length > 10) {
        processingStatsRef.current.peakTimestamps.shift();
      }
    }

    console.log('useHeartBeatProcessor - resultado detallado:', {
      bpm: result.bpm,
      confidence: result.confidence,
      isPeak: result.isPeak,
      arrhythmiaCount: result.arrhythmiaCount,
      rrIntervals: JSON.stringify(rrData.intervals),
      ultimosIntervalos: rrData.intervals.slice(-5),
      ultimoPico: rrData.lastPeakTime,
      tiempoDesdeUltimoPico: rrData.lastPeakTime ? Date.now() - rrData.lastPeakTime : null,
      processingLatency: processingStats.latency.toFixed(2) + 'ms',
      detectedPeaks: result.detectedPeaks?.length || 0,
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    if (result.confidence < 0.7) {
      console.log('useHeartBeatProcessor: Confianza insuficiente, ignorando pico', { confidence: result.confidence });
      return {
        bpm: currentBPM,
        confidence: result.confidence,
        isPeak: false,
        arrhythmiaCount: 0,
        rrData,
        detectedPeaks: result.detectedPeaks
      };
    }

    if (result.bpm > 0) {
      console.log('useHeartBeatProcessor - Actualizando BPM y confianza', {
        prevBPM: currentBPM,
        newBPM: result.bpm,
        prevConfidence: confidence,
        newConfidence: result.confidence,
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
      
      setCurrentBPM(result.bpm);
      setConfidence(result.confidence);
    }

    return {
      ...result,
      rrData,
      detectedPeaks: result.detectedPeaks
    };
  }, [currentBPM, confidence]);

  const reset = useCallback(() => {
    console.log('useHeartBeatProcessor: Reseteando processor', {
      sessionId: sessionId.current,
      prevBPM: currentBPM,
      prevConfidence: confidence,
      timestamp: new Date().toISOString()
    });
    
    if (processorRef.current) {
      processorRef.current.reset();
      console.log('useHeartBeatProcessor: Processor reseteado correctamente', {
        timestamp: new Date().toISOString()
      });
    } else {
      console.warn('useHeartBeatProcessor: No se pudo resetear - processor no existe', {
        timestamp: new Date().toISOString()
      });
    }
    
    processingStatsRef.current = {
      latency: 0,
      peakTimestamps: []
    };
    
    setCurrentBPM(0);
    setConfidence(0);
  }, [currentBPM, confidence]);

  const getProcessingStats = useCallback(() => {
    return { ...processingStatsRef.current };
  }, []);

  return {
    currentBPM,
    confidence,
    processSignal,
    reset,
    getProcessingStats
  };
};

import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';
import { toast } from 'sonner';
import { RRAnalysisResult } from './arrhythmia/types';
import { useSignalCoreContext } from './useSignalCore';
import { HeartBeatResult, UseHeartBeatReturn } from './heart-beat/types';

export const useHeartBeatProcessor = (): UseHeartBeatReturn => {
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  const missedBeepsCounter = useRef<number>(0);
  const isMonitoringRef = useRef<boolean>(false);
  const initializedRef = useRef<boolean>(false);
  const lastProcessedPeakTimeRef = useRef<number>(0);

  // Mantener el último resultado para exponer isArrhythmia y arrhythmiaCount
  const lastResultRef = useRef<HeartBeatResult | null>(null);

  // Usar el contexto centralizado de señal
  const { signalState, processValue, startProcessing, stopProcessing, getChannel } = useSignalCoreContext();

  // Obtener canal de frecuencia cardíaca
  const heartbeatChannel = signalState.channels.get('heartbeat');
  const heartRate = heartbeatChannel?.getMetadata('heartRate') || 0;
  const confidence = heartbeatChannel?.getLastMetadata()?.quality || 0;
  const lastPeakTime = heartbeatChannel?.getMetadata('lastPeakTime') || null;
  const rrData = {
    intervals: heartbeatChannel?.getMetadata('rrIntervals') || [],
    lastPeakTime
  };
  const arrhythmiaCount = signalState.channels.get('arrhythmia')?.getMetadata('arrhythmiaCount') || 0;
  const isArrhythmia = arrhythmiaCount > 0;

  useEffect(() => {
    console.log('useHeartBeatProcessor: Initializing new processor', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    try {
      if (!processorRef.current) {
        processorRef.current = new HeartBeatProcessor();
        console.log('HeartBeatProcessor: New instance created - sin audio activado');
        initializedRef.current = true;
        
        if (typeof window !== 'undefined') {
          (window as any).heartBeatProcessor = processorRef.current;
        }
      }
      
      if (processorRef.current) {
        processorRef.current.startMonitoring();
        console.log('HeartBeatProcessor: Monitoring state set to true, audio centralizado en PPGSignalMeter');
        isMonitoringRef.current = true;
      }
    } catch (error) {
      console.error('Error initializing HeartBeatProcessor:', error);
      toast.error('Error initializing heartbeat processor');
    }

    return () => {
      console.log('useHeartBeatProcessor: Cleaning up processor', {
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
      
      if (processorRef.current) {
        processorRef.current.stopMonitoring();
        processorRef.current = null;
      }
      
      if (typeof window !== 'undefined') {
        (window as any).heartBeatProcessor = undefined;
      }
    };
  }, []);

  // Esta función ahora no hace nada, el beep está centralizado en PPGSignalMeter
  const requestBeep = useCallback((value: number): boolean => {
    console.log('useHeartBeatProcessor: Beep ELIMINADO - Todo el sonido SOLO en PPGSignalMeter', {
      value,
      isMonitoring: isMonitoringRef.current,
      processorExists: !!processorRef.current,
      timestamp: new Date().toISOString()
    });
    
    return false;
  }, []);

  const processSignal = useCallback((value: number): HeartBeatResult => {
    if (!processorRef.current) {
      const emptyResult = {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        arrhythmiaCount: 0,
        isArrhythmia: false,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      };
      lastResultRef.current = emptyResult;
      return emptyResult;
    }

    const result = processSignalInternal(
      value, 
      heartRate, 
      confidence, 
      processorRef.current, 
      requestBeep, 
      isMonitoringRef,
      lastRRIntervalsRef,
      currentBeatIsArrhythmiaRef
    );

    if (result.bpm > 0 && result.confidence > 0.4) {
      // No se actualiza heartRate, confidence, etc., aquí, se actualiza en el contexto
    }

    lastResultRef.current = result;

    // Llamar a registerBeat SOLO cuando se detecta un pico real
    if (result.isPeak) {
      registerBeat();
      // No se actualiza lastPeakTime aquí, se actualiza en el contexto
    }
    // Detectar arritmia en tiempo real
    if (beats.length > 0) {
      const lastBeat = beats[beats.length - 1];
      // No se actualiza isArrhythmia aquí, se actualiza en el contexto
    }

    return {
      bpm: heartRate,
      confidence,
      isPeak: result.isPeak,
      arrhythmiaCount: beats.filter(b => b.isAnomalous).length,
      rrData: {
        intervals: beats.map(b => b.rr),
        lastPeakTime: lastPeakTime
      },
      isArrhythmia: isArrhythmia
    };
  }, [
    heartRate, 
    confidence, 
    processSignalInternal, 
    requestBeep,
    beats,
    isArrhythmia,
    registerBeat
  ]);

  const reset = useCallback(() => {
    console.log('useHeartBeatProcessor: Resetting processor', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    if (processorRef.current) {
      processorRef.current.stopMonitoring();
      isMonitoringRef.current = false;
      
      processorRef.current.reset();
      // No iniciamos audio aquí, está centralizado en PPGSignalMeter
    }
    
    missedBeepsCounter.current = 0;
    lastProcessedPeakTimeRef.current = 0;
    
    cleanupBeepProcessor();
    resetArrhythmia();
  }, [cleanupBeepProcessor, resetArrhythmia]);

  const startMonitoring = useCallback(() => {
    console.log('useHeartBeatProcessor: Starting monitoring');
    if (processorRef.current) {
      isMonitoringRef.current = true;
      processorRef.current.startMonitoring();
      console.log('HeartBeatProcessor: Monitoring state set to true');
      
      lastPeakTimeRef.current = null;
      lastBeepTimeRef.current = 0;
      lastProcessedPeakTimeRef.current = 0;
      pendingBeepsQueue.current = [];
      consecutiveWeakSignalsRef.current = 0;
      
      // No iniciamos audio ni test beep aquí, está centralizado en PPGSignalMeter
      
      if (beepProcessorTimeoutRef.current) {
        clearTimeout(beepProcessorTimeoutRef.current);
        beepProcessorTimeoutRef.current = null;
      }
    }
  }, []);

  const stopMonitoring = useCallback(() => {
    console.log('useHeartBeatProcessor: Stopping monitoring');
    if (processorRef.current) {
      isMonitoringRef.current = false;
      processorRef.current.stopMonitoring();
      console.log('HeartBeatProcessor: Monitoring state set to false');
    }
    
    cleanupBeepProcessor();
    
    // No se actualiza heartRate, confidence, etc., aquí, se actualiza en el contexto
  }, [cleanupBeepProcessor]);

  // API pública compatible
  return {
    currentBPM: heartRate,
    confidence,
    processSignal: (value: number) => {
      processValue(value);
      return {
        bpm: heartRate,
        confidence,
        isPeak: heartbeatChannel?.getLastMetadata()?.isPeak || false,
        arrhythmiaCount,
        isArrhythmia,
        rrData
      };
    },
    reset: stopProcessing,
    isArrhythmia,
    requestBeep: () => false, // El beep está centralizado en el componente visual
    startMonitoring,
    stopMonitoring,
    arrhythmiaCount,
    arrhythmiaPhase: undefined,
    baseRR: undefined,
    baseSDNN: undefined,
    beats: undefined
  };
};


import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '@/modules/HeartBeatProcessor';
import { useBeepProcessor } from './beep-processor';
import { useArrhythmiaDetector } from './arrhythmia-detector';
import { useSignalProcessor } from './signal-processor';
import { HeartBeatResult, UseHeartBeatReturn } from './types';
import { toast } from 'sonner';

/**
 * Hook optimizado para el procesamiento de frecuencia cardíaca
 * Incluye detección de arritmias y procesamiento de señal mejorado
 */
export const useHeartBeatProcessor = (): UseHeartBeatReturn => {
  // Referencias y estado
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  // Contadores y referencias de estado
  const missedBeepsCounter = useRef<number>(0);
  const isMonitoringRef = useRef<boolean>(false);
  const initializedRef = useRef<boolean>(false);
  const lastProcessedPeakTimeRef = useRef<number>(0);
  const frameProcessedCount = useRef<number>(0);
  
  // Hooks para procesamiento especializado
  const { 
    requestImmediateBeep, 
    processBeepQueue, 
    pendingBeepsQueue, 
    lastBeepTimeRef, 
    beepProcessorTimeoutRef, 
    cleanup: cleanupBeepProcessor 
  } = useBeepProcessor();
  
  const {
    detectArrhythmia,
    heartRateVariabilityRef,
    stabilityCounterRef,
    lastRRIntervalsRef,
    lastIsArrhythmiaRef,
    currentBeatIsArrhythmiaRef,
    reset: resetArrhythmiaDetector
  } = useArrhythmiaDetector();
  
  const {
    processSignal: processSignalInternal,
    reset: resetSignalProcessor,
    lastPeakTimeRef,
    lastValidBpmRef,
    lastSignalQualityRef,
    consecutiveWeakSignalsRef,
    MAX_CONSECUTIVE_WEAK_SIGNALS
  } = useSignalProcessor();

  // Inicialización del procesador
  useEffect(() => {
    console.log('useHeartBeatProcessor: Inicializando procesador optimizado', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    try {
      if (!processorRef.current) {
        processorRef.current = new HeartBeatProcessor();
        console.log('HeartBeatProcessor: Nueva instancia creada - optimizada para rendimiento');
        initializedRef.current = true;
        
        // Para debugging
        if (typeof window !== 'undefined') {
          (window as any).heartBeatProcessor = processorRef.current;
        }
      }
      
      if (processorRef.current) {
        processorRef.current.setMonitoring(true);
        console.log('HeartBeatProcessor: Estado de monitoreo establecido a true');
        isMonitoringRef.current = true;
      }
    } catch (error) {
      console.error('Error inicializando HeartBeatProcessor:', error);
      toast.error('Error al inicializar el procesador de pulsaciones');
    }

    return () => {
      console.log('useHeartBeatProcessor: Limpiando procesador', {
        sessionId: sessionId.current,
        procesados: frameProcessedCount.current,
        timestamp: new Date().toISOString()
      });
      
      if (processorRef.current) {
        processorRef.current.setMonitoring(false);
        processorRef.current = null;
      }
      
      if (typeof window !== 'undefined') {
        (window as any).heartBeatProcessor = undefined;
      }
    };
  }, []);

  // Función optimizada para solicitar un beep
  const requestBeep = useCallback((value: number): boolean => {
    if (!isMonitoringRef.current || !processorRef.current) {
      return false;
    }
    
    // Mejorado con detección de calidad
    const quality = lastSignalQualityRef.current;
    const shouldPlayBeep = quality > 60; // Solo reproducir si la calidad es buena
    
    if (shouldPlayBeep) {
      requestImmediateBeep();
    } else {
      missedBeepsCounter.current++;
      // Si perdemos demasiados beeps, podríamos notificar al usuario
      if (missedBeepsCounter.current > 5) {
        console.log('Demasiados beeps perdidos, la señal puede ser débil');
      }
    }
    
    return shouldPlayBeep;
  }, [requestImmediateBeep, lastSignalQualityRef]);

  // Función optimizada para procesar señales
  const processSignal = useCallback((value: number): HeartBeatResult => {
    frameProcessedCount.current++;
    
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

    // Procesar señal con toda la integración de componentes
    const result = processSignalInternal(
      value, 
      currentBPM, 
      confidence, 
      processorRef.current, 
      requestBeep, 
      isMonitoringRef, 
      lastRRIntervalsRef, 
      currentBeatIsArrhythmiaRef
    );

    // Actualizar estado solo si tenemos valores confiables
    if (result.bpm > 0 && result.confidence > 0.4) {
      setCurrentBPM(result.bpm);
      setConfidence(result.confidence);
    }

    // Detección de arritmias mejorada
    if (lastRRIntervalsRef.current.length >= 3) {
      const arrhythmiaResult = detectArrhythmia(lastRRIntervalsRef.current);
      currentBeatIsArrhythmiaRef.current = arrhythmiaResult.isArrhythmia;
      
      result.isArrhythmia = currentBeatIsArrhythmiaRef.current;
      
      // Important: Make sure the HeartBeatProcessor knows about arrhythmia
      if (processorRef.current && result.isArrhythmia && typeof processorRef.current.getArrhythmiaCounter === 'function') {
        console.log("Arrhythmia detected! Updating processor counter.");
        // Instead of trying to modify private property, use the method if it exists
        // The processor should handle the counter increment internally
        processorRef.current.updateArrhythmiaCounter?.();
      }
    }

    // Registro periódico para depuración
    if (frameProcessedCount.current % 100 === 0) {
      console.log('HeartBeatProcessor: Frames procesados', {
        count: frameProcessedCount.current,
        bpm: result.bpm,
        confidence: result.confidence,
        isArrhythmia: result.isArrhythmia
      });
    }

    return result;
  }, [
    currentBPM, 
    confidence, 
    processSignalInternal, 
    requestBeep, 
    detectArrhythmia, 
    lastRRIntervalsRef,
    currentBeatIsArrhythmiaRef,
    isMonitoringRef
  ]);

  // Reset mejorado
  const reset = useCallback(() => {
    console.log('useHeartBeatProcessor: Reiniciando procesador', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString(),
      framesProcessed: frameProcessedCount.current
    });
    
    if (processorRef.current) {
      processorRef.current.setMonitoring(false);
      isMonitoringRef.current = false;
      
      processorRef.current.reset();
    }
    
    setCurrentBPM(0);
    setConfidence(0);
    
    resetArrhythmiaDetector();
    resetSignalProcessor();
    
    missedBeepsCounter.current = 0;
    lastProcessedPeakTimeRef.current = 0;
    frameProcessedCount.current = 0;
    
    cleanupBeepProcessor();
    
    return null;
  }, [resetArrhythmiaDetector, resetSignalProcessor, cleanupBeepProcessor]);

  // Iniciar monitoreo
  const startMonitoring = useCallback(() => {
    console.log('useHeartBeatProcessor: Iniciando monitoreo optimizado');
    if (processorRef.current) {
      isMonitoringRef.current = true;
      processorRef.current.setMonitoring(true);
      
      lastPeakTimeRef.current = null;
      lastBeepTimeRef.current = 0;
      lastProcessedPeakTimeRef.current = 0;
      pendingBeepsQueue.current = [];
      consecutiveWeakSignalsRef.current = 0;
      frameProcessedCount.current = 0;
      
      if (beepProcessorTimeoutRef.current) {
        clearTimeout(beepProcessorTimeoutRef.current);
        beepProcessorTimeoutRef.current = null;
      }
    }
  }, [beepProcessorTimeoutRef, consecutiveWeakSignalsRef, lastBeepTimeRef, lastPeakTimeRef, pendingBeepsQueue]);

  // Detener monitoreo
  const stopMonitoring = useCallback(() => {
    console.log('useHeartBeatProcessor: Deteniendo monitoreo', {
      framesProcessed: frameProcessedCount.current
    });
    if (processorRef.current) {
      isMonitoringRef.current = false;
      processorRef.current.setMonitoring(false);
    }
    
    cleanupBeepProcessor();
    
    setCurrentBPM(0);
    setConfidence(0);
  }, [cleanupBeepProcessor]);

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

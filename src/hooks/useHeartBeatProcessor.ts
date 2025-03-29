import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';
import { toast } from 'sonner';
import { RRAnalysisResult } from './arrhythmia/types';
import { useBeepProcessor } from './heart-beat/beep-processor';
import { useArrhythmiaDetector } from './heart-beat/arrhythmia-detector';
import { useSignalProcessor } from './heart-beat/signal-processor';
import { HeartBeatResult, UseHeartBeatReturn } from './heart-beat/types';
import { playHeartbeatSound } from '../utils/audioUtils';
import FeedbackService from '../services/FeedbackService';

export const useHeartBeatProcessor = (): UseHeartBeatReturn => {
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  const missedBeepsCounter = useRef<number>(0);
  const isMonitoringRef = useRef<boolean>(false);
  const initializedRef = useRef<boolean>(false);
  const lastProcessedPeakTimeRef = useRef<number>(0);
  
  // Referencia al contexto de audio
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Hooks para procesamiento y detección, sin funcionalidad de beep
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

  // Inicializar el contexto de audio
  useEffect(() => {
    if (typeof AudioContext !== 'undefined' && !audioContextRef.current) {
      try {
        audioContextRef.current = new AudioContext({ latencyHint: 'interactive' });
        console.log('AudioContext inicializado para sonidos de latidos reales');
        
        // Precargar sonido de latido
        const preloadHeartbeat = async () => {
          try {
            if (audioContextRef.current && audioContextRef.current.state === 'running') {
              await playHeartbeatSound(audioContextRef.current, '/sounds/heartbeat.mp3', 0.01);
              console.log('Sonido de latido precargado');
            }
          } catch (err) {
            console.error('Error precargando sonido de latido:', err);
          }
        };
        
        // Intentar precargar cuando el usuario interactúe con la página
        const prepareAudio = async () => {
          console.log("Evento de interacción detectado, preparando audio");
          if (audioContextRef.current) {
            try {
              if (audioContextRef.current.state !== 'running') {
                await audioContextRef.current.resume();
                console.log("AudioContext resumido:", audioContextRef.current.state);
              }
              // Ejecutar test de audio
              await FeedbackService.testAudio();
              // Precargar sonido de latido
              await preloadHeartbeat();
            } catch (err) {
              console.error("Error preparando audio:", err);
            }
          }
        };
        
        window.addEventListener('click', prepareAudio, { once: false });
        window.addEventListener('touchstart', prepareAudio, { once: false });
        
        // Test inmediato para debug
        setTimeout(() => {
          console.log("Test de audio programado");
          FeedbackService.testAudio();
        }, 2000);
        
        return () => {
          window.removeEventListener('click', prepareAudio);
          window.removeEventListener('touchstart', prepareAudio);
        };
      } catch (error) {
        console.error('Error inicializando contexto de audio:', error);
      }
    }
    
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(err => {
          console.error('Error cerrando contexto de audio:', err);
        });
      }
    };
  }, []);

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
        processorRef.current.setMonitoring(true);
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
        processorRef.current.setMonitoring(false);
        processorRef.current = null;
      }
      
      if (typeof window !== 'undefined') {
        (window as any).heartBeatProcessor = undefined;
      }
    };
  }, []);

  // Función para reproducir sonido de latido cardíaco real
  const playRealHeartbeatSound = useCallback(async (volume: number = 0.9): Promise<boolean> => {
    if (!isMonitoringRef.current) {
      console.log('No reproduciendo sonido porque no está en monitoreo');
      return false;
    }
    
    try {
      return await FeedbackService.playHeartbeat(volume);
    } catch (err) {
      console.error('Error reproduciendo sonido de latido real:', err);
      return false;
    }
  }, []);

  // Reemplazamos la implementación actual de requestBeep para usar el sonido real
  const requestBeep = useCallback((value: number): boolean => {
    if (isMonitoringRef.current && processorRef.current) {
      // Llamar a playRealHeartbeatSound en lugar del beep sintético
      playRealHeartbeatSound(value * 0.9);
      return true;
    }
    return false;
  }, [playRealHeartbeatSound]);

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

    if (result.bpm > 0 && result.confidence > 0.4) {
      setCurrentBPM(result.bpm);
      setConfidence(result.confidence);
    }

    if (lastRRIntervalsRef.current.length >= 3) {
      const arrhythmiaResult = detectArrhythmia(lastRRIntervalsRef.current);
      currentBeatIsArrhythmiaRef.current = arrhythmiaResult.isArrhythmia;
      
      result.isArrhythmia = currentBeatIsArrhythmiaRef.current;
    }

    return result;
  }, [
    currentBPM, 
    confidence, 
    processSignalInternal, 
    requestBeep, 
    detectArrhythmia
  ]);

  const reset = useCallback(() => {
    console.log('useHeartBeatProcessor: Resetting processor', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
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
    
    cleanupBeepProcessor();
    
    // Intentar reactivar el contexto de audio si está suspendido
    if (audioContextRef.current && audioContextRef.current.state !== 'running') {
      audioContextRef.current.resume().catch(err => {
        console.error('Error reactivando contexto de audio durante reset:', err);
      });
    }
  }, [resetArrhythmiaDetector, resetSignalProcessor, cleanupBeepProcessor]);

  const startMonitoring = useCallback(async () => {
    console.log('useHeartBeatProcessor: Starting monitoring');
    
    // Intentar activar el audio al iniciar el monitoreo
    try {
      if (audioContextRef.current && audioContextRef.current.state !== 'running') {
        await audioContextRef.current.resume();
        console.log('AudioContext activado al iniciar monitoreo:', audioContextRef.current.state);
      }
      // Realizar test de audio
      await FeedbackService.testAudio();
    } catch (err) {
      console.error('Error activando audio al iniciar monitoreo:', err);
    }
    
    if (processorRef.current) {
      isMonitoringRef.current = true;
      processorRef.current.setMonitoring(true);
      console.log('HeartBeatProcessor: Monitoring state set to true');
      
      lastPeakTimeRef.current = null;
      lastBeepTimeRef.current = 0;
      lastProcessedPeakTimeRef.current = 0;
      pendingBeepsQueue.current = [];
      consecutiveWeakSignalsRef.current = 0;
      
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
      processorRef.current.setMonitoring(false);
      console.log('HeartBeatProcessor: Monitoring state set to false');
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
    stopMonitoring,
    playRealHeartbeatSound
  };
};

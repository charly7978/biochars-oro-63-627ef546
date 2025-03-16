
import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';

interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  filteredValue?: number;
  arrhythmiaCount: number;
  isArrhythmia?: boolean;
  rrData?: {
    intervals: number[];
    lastPeakTime: number | null;
  };
}

export const useHeartBeatProcessor = () => {
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const lastPeakTimeRef = useRef<number | null>(null);
  const lastBeepTimeRef = useRef<number>(0);
  const MIN_BEEP_INTERVAL_MS = 300; // Minimum time between beeps
  const lastRRIntervalsRef = useRef<number[]>([]);
  const lastIsArrhythmiaRef = useRef<boolean>(false);
  const currentBeatIsArrhythmiaRef = useRef<boolean>(false);
  const arrhythmiaStartTimeRef = useRef<number | null>(null);
  const arrhythmiaEndTimeRef = useRef<number | null>(null);
  const ARRHYTHMIA_DURATION_MS = 1000; // Duration to mark a beat as arrhythmic

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

  // Function to manually trigger beep sound when a peak is detected
  const playBeepSound = useCallback(() => {
    if (!processorRef.current) return;
    
    const now = Date.now();
    if (now - lastBeepTimeRef.current < MIN_BEEP_INTERVAL_MS) return;
    
    try {
      processorRef.current.playBeep();
      lastBeepTimeRef.current = now;
      console.log('useHeartBeatProcessor: Beep manual reproducido en', new Date().toISOString());
    } catch (err) {
      console.error('useHeartBeatProcessor: Error al reproducir beep manual', err);
    }
  }, []);

  // Function to determine if the current beat pattern indicates an arrhythmia
  // Modified to analyze only individual beats, not the whole pattern
  const detectArrhythmia = useCallback((rrIntervals: number[]): boolean => {
    if (rrIntervals.length < 3) return false;
    
    // We only care about the last interval for individual beat analysis
    const lastInterval = rrIntervals[rrIntervals.length - 1];
    
    // Get previous intervals for comparison
    const previousIntervals = rrIntervals.slice(-4, -1);
    const avgPreviousInterval = previousIntervals.reduce((sum, val) => sum + val, 0) / previousIntervals.length;
    
    // Calculate how much this specific beat differs from previous ones
    const variationFromPrevious = Math.abs(lastInterval - avgPreviousInterval) / avgPreviousInterval;
    
    // This specific beat is arrhythmic if it's significantly early or late
    const isPrematureBeat = lastInterval < 0.75 * avgPreviousInterval;
    const isDelayedBeat = lastInterval > 1.35 * avgPreviousInterval;
    
    // Mark only this specific beat as arrhythmic
    const thisIsArrhythmia = isPrematureBeat || isDelayedBeat;
    
    if (thisIsArrhythmia) {
      // Set the start time for the arrhythmia wave marking
      arrhythmiaStartTimeRef.current = Date.now();
      arrhythmiaEndTimeRef.current = Date.now() + ARRHYTHMIA_DURATION_MS;
      
      console.log('useHeartBeatProcessor: Individual arrítmico detectado', {
        tipo: isPrematureBeat ? 'prematuro' : 'retrasado',
        intervaloActual: lastInterval,
        promedioAnterior: avgPreviousInterval,
        variación: variationFromPrevious,
        timestamp: new Date().toISOString(),
        arrhythmiaStart: arrhythmiaStartTimeRef.current,
        arrhythmiaEnd: arrhythmiaEndTimeRef.current
      });
    }
    
    return thisIsArrhythmia;
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
        }
      };
    }

    const result = processorRef.current.processSignal(value);
    const rrData = processorRef.current.getRRIntervals();
    
    // Update our RR intervals tracking
    if (rrData && rrData.intervals.length > 0) {
      lastRRIntervalsRef.current = [...rrData.intervals];
    }
    
    // Determine if THIS SPECIFIC beat is an arrhythmia
    let currentBeatIsArrhythmia = false;
    
    // Check if we're within an active arrhythmia period
    const now = Date.now();
    if (arrhythmiaStartTimeRef.current !== null && arrhythmiaEndTimeRef.current !== null) {
      if (now <= arrhythmiaEndTimeRef.current) {
        currentBeatIsArrhythmia = true;
      } else {
        // Reset arrhythmia period if it's over
        arrhythmiaStartTimeRef.current = null;
        arrhythmiaEndTimeRef.current = null;
      }
    }
    
    // Only check for arrhythmia if we detected a peak
    if (result.isPeak && result.confidence > 0.85 && lastRRIntervalsRef.current.length >= 3) {
      const newArrhythmia = detectArrhythmia(lastRRIntervalsRef.current);
      if (newArrhythmia) {
        currentBeatIsArrhythmia = true;
      }
      // Store the arrhythmia state for this beat
      currentBeatIsArrhythmiaRef.current = currentBeatIsArrhythmia;
    }

    // Si se detecta un pico y ha pasado suficiente tiempo desde el último pico
    if (result.isPeak && 
        (!lastPeakTimeRef.current || 
         Date.now() - lastPeakTimeRef.current >= MIN_BEEP_INTERVAL_MS)) {
      
      lastPeakTimeRef.current = Date.now();
      // Reproducir beep manualmente para sincronizar con el pico detectado
      playBeepSound();
    }

    // Aumentamos umbral de confianza para reducir falsos positivos
    if (result.confidence < 0.8) {
      return {
        bpm: currentBPM,
        confidence: result.confidence,
        isPeak: false,
        arrhythmiaCount: 0,
        isArrhythmia: currentBeatIsArrhythmia,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      };
    }

    if (result.bpm > 0) {
      setCurrentBPM(result.bpm);
      setConfidence(result.confidence);
    }

    return {
      ...result,
      isArrhythmia: currentBeatIsArrhythmia,
      rrData
    };
  }, [currentBPM, confidence, playBeepSound, detectArrhythmia]);

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
    
    setCurrentBPM(0);
    setConfidence(0);
    lastPeakTimeRef.current = null;
    lastBeepTimeRef.current = 0;
    lastRRIntervalsRef.current = [];
    lastIsArrhythmiaRef.current = false;
    currentBeatIsArrhythmiaRef.current = false;
    arrhythmiaStartTimeRef.current = null;
    arrhythmiaEndTimeRef.current = null;
  }, [currentBPM, confidence]);

  return {
    currentBPM,
    confidence,
    processSignal,
    reset,
    isArrhythmia: currentBeatIsArrhythmiaRef.current
  };
};

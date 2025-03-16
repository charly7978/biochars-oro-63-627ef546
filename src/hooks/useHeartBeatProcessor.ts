
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
  
  const beatHistoryRef = useRef<Array<{time: number, isArrhythmia: boolean}>>([]);
  const currentArrhythmiaWindowRef = useRef<{start: number, end: number | null}>({start: 0, end: null});

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

  const detectArrhythmia = useCallback((rrIntervals: number[]): boolean => {
    if (rrIntervals.length < 3) return false;
    
    const lastThree = rrIntervals.slice(-3);
    const lastInterval = lastThree[lastThree.length - 1];
    
    const previousIntervals = rrIntervals.slice(-6, -1);
    const avgPreviousInterval = previousIntervals.reduce((sum, val) => sum + val, 0) / previousIntervals.length;
    
    const variationFromAvg = Math.abs(lastInterval - avgPreviousInterval) / avgPreviousInterval;
    
    const isPrematureBeat = lastInterval < 0.7 * avgPreviousInterval;
    const isDelayedBeat = lastInterval > 1.35 * avgPreviousInterval;
    const isIrregularVariation = variationFromAvg > 0.25;
    
    const isArrhythmia = isPrematureBeat || isDelayedBeat || isIrregularVariation;
    
    if (isArrhythmia) {
      const now = Date.now();
      
      beatHistoryRef.current.push({time: now, isArrhythmia: true});
      
      if (currentArrhythmiaWindowRef.current.end !== null) {
        currentArrhythmiaWindowRef.current = {
          start: now, 
          end: null
        };
      }
      
      console.log('useHeartBeatProcessor: Latido arrítmico detectado', {
        tipo: isPrematureBeat ? 'prematuro' : isDelayedBeat ? 'retrasado' : 'irregular',
        intervaloActual: lastInterval,
        promedioAnterior: avgPreviousInterval,
        variación: variationFromAvg,
        timestamp: new Date().toISOString()
      });
    } else {
      const now = Date.now(); // Fix: Added missing 'now' variable
      beatHistoryRef.current.push({time: now, isArrhythmia: false});
      
      if (currentArrhythmiaWindowRef.current.end === null) {
        currentArrhythmiaWindowRef.current.end = Date.now();
      }
    }
    
    if (beatHistoryRef.current.length > 20) {
      beatHistoryRef.current = beatHistoryRef.current.slice(-20);
    }
    
    return isArrhythmia;
  }, []);

  const isTimestampInArrhythmiaWindow = useCallback((timestamp: number): boolean => {
    if (currentArrhythmiaWindowRef.current.end === null) {
      return timestamp >= currentArrhythmiaWindowRef.current.start;
    }
    
    const arrhythmicBeats = beatHistoryRef.current.filter(beat => beat.isArrhythmia);
    
    return arrhythmicBeats.some(beat => Math.abs(beat.time - timestamp) < 500);
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
    const now = Date.now();
    
    if (rrData && rrData.intervals.length > 0) {
      lastRRIntervalsRef.current = [...rrData.intervals];
    }
    
    let currentBeatIsArrhythmia = false;
    
    if (result.isPeak && result.confidence > 0.85 && lastRRIntervalsRef.current.length >= 3) {
      currentBeatIsArrhythmia = detectArrhythmia(lastRRIntervalsRef.current);
      currentBeatIsArrhythmiaRef.current = currentBeatIsArrhythmia;
      lastIsArrhythmiaRef.current = currentBeatIsArrhythmia;
    } else {
      currentBeatIsArrhythmiaRef.current = isTimestampInArrhythmiaWindow(now);
    }

    if (result.isPeak && 
        (!lastPeakTimeRef.current || 
         now - lastPeakTimeRef.current >= MIN_BEEP_INTERVAL_MS)) {
      
      lastPeakTimeRef.current = now;
      playBeepSound();
    }

    if (result.confidence < 0.8) {
      return {
        bpm: currentBPM,
        confidence: result.confidence,
        isPeak: false,
        arrhythmiaCount: 0,
        isArrhythmia: currentBeatIsArrhythmiaRef.current,
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
      isArrhythmia: currentBeatIsArrhythmiaRef.current,
      rrData
    };
  }, [currentBPM, confidence, playBeepSound, detectArrhythmia, isTimestampInArrhythmiaWindow]);

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
    beatHistoryRef.current = [];
    currentArrhythmiaWindowRef.current = {start: 0, end: null};
  }, [currentBPM, confidence]);

  return {
    currentBPM,
    confidence,
    processSignal,
    reset,
    isArrhythmia: currentBeatIsArrhythmiaRef.current
  };
};

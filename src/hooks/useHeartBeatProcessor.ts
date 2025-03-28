
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
  const [isArrhythmia, setIsArrhythmia] = useState<boolean>(false);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const lastPeakTimeRef = useRef<number | null>(null);
  const lastBeepTimeRef = useRef<number>(0);
  const MIN_BEEP_INTERVAL_MS = 300; // Minimum time between beeps
  const lastRRIntervalsRef = useRef<number[]>([]);
  const arrhythmiaCounterRef = useRef<number>(0);
  
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
        isArrhythmia: false,
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

    // Determinar si es un latido arrítmico
    let beatIsArrhythmic = false;
    
    if (rrData && rrData.intervals.length >= 5) {
      const recentIntervals = rrData.intervals.slice(-5);
      const avgRR = recentIntervals.reduce((a, b) => a + b, 0) / recentIntervals.length;
      const lastRR = recentIntervals[recentIntervals.length - 1];
      
      // Un latido es arrítmico si varía más del 30% del promedio
      const variation = Math.abs(lastRR - avgRR) / avgRR;
      beatIsArrhythmic = variation > 0.3 || lastRR < 0.7 * avgRR || lastRR > 1.3 * avgRR;
      
      // Actualizar estado de arritmia
      setIsArrhythmia(beatIsArrhythmic);
      
      if (beatIsArrhythmic && result.isPeak) {
        arrhythmiaCounterRef.current++;
      }
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
        arrhythmiaCount: arrhythmiaCounterRef.current,
        isArrhythmia: beatIsArrhythmic,
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
      arrhythmiaCount: arrhythmiaCounterRef.current,
      isArrhythmia: beatIsArrhythmic,
      rrData
    };
  }, [currentBPM, confidence, playBeepSound]);

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
    setIsArrhythmia(false);
    lastPeakTimeRef.current = null;
    lastBeepTimeRef.current = 0;
    lastRRIntervalsRef.current = [];
    arrhythmiaCounterRef.current = 0;
  }, [currentBPM, confidence]);

  return {
    currentBPM,
    confidence,
    processSignal,
    reset,
    isArrhythmia
  };
};

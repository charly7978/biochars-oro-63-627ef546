
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
}

export const useHeartBeatProcessor = () => {
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const lastProcessedTimeRef = useRef<number>(0);
  const processingIntervalRef = useRef<number>(25); // Process at 40Hz by default

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
        }
      };
    }

    // Implement rate limiting to avoid processing too many signals too quickly
    const now = Date.now();
    if (now - lastProcessedTimeRef.current < processingIntervalRef.current) {
      return {
        bpm: currentBPM,
        confidence,
        isPeak: false,
        filteredValue: value,
        arrhythmiaCount: 0,
        rrData: processorRef.current.getRRIntervals()
      };
    }
    lastProcessedTimeRef.current = now;

    // Apply signal amplification for better peak detection
    const amplifiedValue = value * 1.35; // Amplify the signal for better detection

    console.log('useHeartBeatProcessor - processSignal detallado:', {
      inputValue: value,
      amplifiedValue: amplifiedValue.toFixed(2),
      normalizadoValue: value.toFixed(2),
      currentProcessor: !!processorRef.current,
      processorMethods: processorRef.current ? Object.getOwnPropertyNames(Object.getPrototypeOf(processorRef.current)) : [],
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });

    const result = processorRef.current.processSignal(amplifiedValue);
    const rrData = processorRef.current.getRRIntervals();

    console.log('useHeartBeatProcessor - resultado detallado:', {
      bpm: result.bpm,
      confidence: result.confidence,
      isPeak: result.isPeak,
      arrhythmiaCount: result.arrhythmiaCount,
      rrIntervals: JSON.stringify(rrData.intervals),
      ultimosIntervalos: rrData.intervals.slice(-5),
      ultimoPico: rrData.lastPeakTime,
      tiempoDesdeUltimoPico: rrData.lastPeakTime ? Date.now() - rrData.lastPeakTime : null,
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    // Use a more strict confidence threshold of 0.8 (instead of 0.7)
    if (result.confidence < 0.8) {
      console.log('useHeartBeatProcessor: Confianza insuficiente, ignorando pico', { confidence: result.confidence });
      return {
        bpm: currentBPM,
        confidence: result.confidence,
        isPeak: false,
        arrhythmiaCount: 0,
        filteredValue: amplifiedValue,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      };
    }

    if (result.bpm > 0) {
      // Only update BPM if it's within a reasonable physiological range
      if (result.bpm >= 45 && result.bpm <= 180) {
        console.log('useHeartBeatProcessor - Actualizando BPM y confianza', {
          prevBPM: currentBPM,
          newBPM: result.bpm,
          prevConfidence: confidence,
          newConfidence: result.confidence,
          sessionId: sessionId.current,
          timestamp: new Date().toISOString()
        });
        
        // Use weighted average to smooth BPM updates
        const newBPM = currentBPM === 0 ? 
          result.bpm : 
          Math.round(result.bpm * 0.3 + currentBPM * 0.7);
        
        setCurrentBPM(newBPM);
        setConfidence(result.confidence);
      } else {
        console.log('useHeartBeatProcessor - BPM fuera de rango fisiológico', {
          invalidBPM: result.bpm,
          sessionId: sessionId.current,
          timestamp: new Date().toISOString()
        });
      }
    }

    return {
      ...result,
      filteredValue: amplifiedValue,
      rrData
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
    
    setCurrentBPM(0);
    setConfidence(0);
    lastProcessedTimeRef.current = 0;
  }, [currentBPM, confidence]);

  return {
    currentBPM,
    confidence,
    processSignal,
    reset
  };
};

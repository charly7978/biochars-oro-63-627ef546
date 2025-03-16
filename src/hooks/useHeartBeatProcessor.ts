
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
  // MODIFICADO: Reducimos sensibilidad para menos falsos positivos
  const detectArrhythmia = useCallback((rrIntervals: number[]): boolean => {
    if (rrIntervals.length < 5) return false; // Aumentamos a 5 intervalos para más estabilidad
    
    // Get the last 5 intervals for analysis (antes: 3)
    const recentIntervals = rrIntervals.slice(-5);
    const avgInterval = recentIntervals.reduce((sum, val) => sum + val, 0) / recentIntervals.length;
    const lastInterval = recentIntervals[recentIntervals.length - 1];
    
    // Calculate RR variation percentage from average - ahora más permisivo
    const variation = Math.abs(lastInterval - avgInterval) / avgInterval;
    
    // Calculate standard deviation for recent intervals
    const stdDev = Math.sqrt(
      recentIntervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / recentIntervals.length
    );
    
    // Detect arrhythmia based on significant variations or extreme values
    // Umbral aumentado del 20% al 30% para reducir falsos positivos
    const isArrhythmia = 
      (variation > 0.30) || // Más del 30% de variación del promedio (antes: 20%)
      (stdDev > 70) ||      // Mayor variabilidad requerida (antes: 40)
      (lastInterval > 1.5 * avgInterval) || // Significativamente más largo (antes: 1.3)
      (lastInterval < 0.6 * avgInterval);   // Significativamente más corto (antes: 0.7)
    
    if (isArrhythmia) {
      console.log('useHeartBeatProcessor: Arrhythmia detected', {
        variation,
        stdDev,
        lastInterval,
        avgInterval,
        threshold: 0.30, // Actualizado
        timestamp: new Date().toISOString()
      });
    }
    
    return isArrhythmia;
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
    
    // Update our RR intervals tracking
    if (rrData && rrData.intervals.length > 0) {
      lastRRIntervalsRef.current = [...rrData.intervals];
    }
    
    // Determine if this beat is an arrhythmia
    // Añadimos filtro adicional de confianza para reducir falsos positivos
    const isArrhythmia = result.confidence > 0.85 && detectArrhythmia(lastRRIntervalsRef.current);
    lastIsArrhythmiaRef.current = isArrhythmia;

    // Si se detecta un pico y ha pasado suficiente tiempo desde el último pico
    if (result.isPeak && 
        (!lastPeakTimeRef.current || 
         Date.now() - lastPeakTimeRef.current >= MIN_BEEP_INTERVAL_MS)) {
      
      lastPeakTimeRef.current = Date.now();
      // Reproducir beep manualmente para sincronizar con el pico detectado
      playBeepSound();
    }

    console.log('useHeartBeatProcessor - resultado detallado:', {
      bpm: result.bpm,
      confidence: result.confidence,
      isPeak: result.isPeak,
      arrhythmiaCount: result.arrhythmiaCount,
      isArrhythmia: isArrhythmia,
      rrIntervals: JSON.stringify(rrData.intervals),
      ultimosIntervalos: rrData.intervals.slice(-5),
      ultimoPico: rrData.lastPeakTime,
      tiempoDesdeUltimoPico: rrData.lastPeakTime ? Date.now() - rrData.lastPeakTime : null,
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    // Aumentamos umbral de confianza para reducir falsos positivos
    if (result.confidence < 0.8) {
      console.log('useHeartBeatProcessor: Confianza insuficiente, ignorando pico', { confidence: result.confidence });
      return {
        bpm: currentBPM,
        confidence: result.confidence,
        isPeak: false,
        arrhythmiaCount: 0,
        isArrhythmia: false,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
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
      isArrhythmia,
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
  }, [currentBPM, confidence]);

  return {
    currentBPM,
    confidence,
    processSignal,
    reset,
    isArrhythmia: lastIsArrhythmiaRef.current
  };
};

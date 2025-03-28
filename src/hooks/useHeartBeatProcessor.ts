
import { useState, useCallback, useRef } from 'react';
import { CircularBuffer } from '../utils/CircularBuffer';

interface HeartBeatResult {
  bpm: number;
  isPeak: boolean;
  value: number;
  time: number;
  confidence: number;
  rrData: {
    intervals: number[];
    lastPeakTime: number | null;
  };
}

interface PPGDataPoint {
  time: number;
  value: number;
}

export const useHeartBeatProcessor = () => {
  const [lastBPM, setLastBPM] = useState(0);
  const [averageRR, setAverageRR] = useState(0);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isArrhythmia, setIsArrhythmia] = useState(false);
  
  const valueBuffer = useRef<number[]>([]);
  const peakBuffer = useRef<CircularBuffer<PPGDataPoint>>(new CircularBuffer<PPGDataPoint>(20));
  const lastPeakTime = useRef<number | null>(null);
  const lastProcessTime = useRef(0);
  const rrIntervals = useRef<number[]>([]);
  const arrhythmiaCounter = useRef(0);
  
  const MIN_PEAK_INTERVAL_MS = 300;
  const MAX_PEAK_INTERVAL_MS = 1500;
  const PEAK_THRESHOLD = 0.3;
  
  /**
   * Detecta si un valor representa un pico de señal
   */
  const detectPeak = useCallback((value: number, timestamp: number): boolean => {
    if (lastPeakTime.current === null || 
        timestamp - lastPeakTime.current >= MIN_PEAK_INTERVAL_MS) {
      
      // Verificar umbral y que sea mayor que valores recientes
      if (value > PEAK_THRESHOLD && valueBuffer.current.length > 3) {
        const recentValues = valueBuffer.current.slice(-3);
        const maxRecent = Math.max(...recentValues);
        
        if (value > maxRecent) {
          lastPeakTime.current = timestamp;
          
          // Actualizamos rrIntervals
          if (lastPeakTime.current) {
            const interval = timestamp - lastPeakTime.current;
            if (interval >= MIN_PEAK_INTERVAL_MS && interval <= MAX_PEAK_INTERVAL_MS) {
              rrIntervals.current.push(interval);
              
              // Mantener buffer limitado
              if (rrIntervals.current.length > 10) {
                rrIntervals.current.shift();
              }
              
              // Calcular promedio RR para SDNN
              const avgRR = rrIntervals.current.reduce((sum, val) => sum + val, 0) / 
                            rrIntervals.current.length;
              setAverageRR(avgRR);
              
              // Detectar arritmia
              checkForArrhythmia();
            }
          }
          
          // Guardar pico
          peakBuffer.current.push({
            time: timestamp,
            value: value
          });
          
          return true;
        }
      }
    }
    
    return false;
  }, []);
  
  /**
   * Verifica si hay arritmia basado en intervalos RR
   */
  const checkForArrhythmia = useCallback(() => {
    if (rrIntervals.current.length < 3) {
      setIsArrhythmia(false);
      return;
    }
    
    // Calcular SDNN (desviación estándar de intervalos NN)
    const mean = rrIntervals.current.reduce((sum, val) => sum + val, 0) / 
                rrIntervals.current.length;
    
    const variance = rrIntervals.current.reduce(
      (sum, val) => sum + Math.pow(val - mean, 2), 0
    ) / rrIntervals.current.length;
    
    const sdnn = Math.sqrt(variance);
    
    // Calcular coeficiente de variación (CV)
    const cv = sdnn / mean;
    
    // Si CV es mayor a umbral, detectar arritmia
    const cvThreshold = 0.15;
    const isCurrentArrhythmia = cv > cvThreshold;
    
    if (isCurrentArrhythmia && !isArrhythmia) {
      arrhythmiaCounter.current++;
    }
    
    setIsArrhythmia(isCurrentArrhythmia);
  }, [isArrhythmia]);
  
  /**
   * Calcula la frecuencia cardíaca a partir de la señal PPG
   */
  const calculateBPM = useCallback(() => {
    if (rrIntervals.current.length < 2) return 0;
    
    // Filtrar outliers
    const sortedIntervals = [...rrIntervals.current].sort((a, b) => a - b);
    const q1 = sortedIntervals[Math.floor(sortedIntervals.length * 0.25)];
    const q3 = sortedIntervals[Math.floor(sortedIntervals.length * 0.75)];
    const iqr = q3 - q1;
    
    const filteredIntervals = rrIntervals.current.filter(
      interval => interval >= q1 - 1.5 * iqr && interval <= q3 + 1.5 * iqr
    );
    
    if (filteredIntervals.length === 0) return 0;
    
    // Calcular promedio de intervalos filtrados
    const avgInterval = filteredIntervals.reduce((sum, val) => sum + val, 0) / 
                        filteredIntervals.length;
    
    // Convertir de ms a BPM
    return Math.round(60000 / avgInterval);
  }, []);
  
  /**
   * Procesa un valor de señal PPG
   */
  const processSignal = useCallback((value: number): HeartBeatResult => {
    if (!isMonitoring) {
      return {
        bpm: 0,
        isPeak: false,
        value: 0,
        time: Date.now(),
        confidence: 0,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      };
    }
    
    const now = Date.now();
    lastProcessTime.current = now;
    
    // Almacenar valor en buffer
    valueBuffer.current.push(value);
    if (valueBuffer.current.length > 30) {
      valueBuffer.current.shift();
    }
    
    // Detectar pico
    const isPeak = detectPeak(value, now);
    
    // Calcular BPM
    const bpm = calculateBPM();
    if (bpm > 0) {
      setLastBPM(bpm);
    }
    
    // Calcular confianza
    let confidence = 0;
    if (rrIntervals.current.length >= 3) {
      const mean = rrIntervals.current.reduce((sum, val) => sum + val, 0) / 
                  rrIntervals.current.length;
      
      const variance = rrIntervals.current.reduce(
        (sum, val) => sum + Math.pow(val - mean, 2), 0
      ) / rrIntervals.current.length;
      
      const cv = Math.sqrt(variance) / mean;
      confidence = Math.max(0, Math.min(1, 1 - cv * 2));
    }
    
    return {
      bpm: bpm || lastBPM,
      isPeak,
      value,
      time: now,
      confidence,
      rrData: {
        intervals: rrIntervals.current,
        lastPeakTime: lastPeakTime.current
      }
    };
  }, [detectPeak, calculateBPM, lastBPM, isMonitoring]);
  
  /**
   * Inicia el monitoreo
   */
  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
  }, []);
  
  /**
   * Detiene el monitoreo
   */
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
  }, []);
  
  /**
   * Reinicia el procesador
   */
  const reset = useCallback(() => {
    valueBuffer.current = [];
    peakBuffer.current.clear();
    rrIntervals.current = [];
    lastPeakTime.current = null;
    lastProcessTime.current = 0;
    arrhythmiaCounter.current = 0;
    setLastBPM(0);
    setAverageRR(0);
    setIsArrhythmia(false);
  }, []);
  
  return {
    processSignal,
    lastBPM,
    averageRR,
    reset,
    isArrhythmia,
    startMonitoring,
    stopMonitoring
  };
};

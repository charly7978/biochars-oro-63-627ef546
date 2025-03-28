
import { useState, useCallback, useRef, useEffect } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';

export interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  filteredValue: number;
  rrData: {
    intervals: number[];
    lastPeakTime: number | null;
  };
}

export const useHeartBeatProcessor = () => {
  const [isArrhythmia, setIsArrhythmia] = useState(false);
  const [lastRRInterval, setLastRRInterval] = useState(0);
  const [rmssd, setRmssd] = useState(0);
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const rrIntervalsRef = useRef<number[]>([]);
  const arrhythmiaCounterRef = useRef<number>(0);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  // Error threshold based on clinical standards for arrhythmia detection
  const RMSSD_THRESHOLD = 25;  // ms
  const DETECTION_WINDOW_SIZE = 8;
  const ARRHYTHMIA_COUNTER_RESET_MS = 5000;
  const lastArrhythmiaTimeRef = useRef<number>(0);
  
  useEffect(() => {
    processorRef.current = new HeartBeatProcessor();
    
    console.log("useHeartBeatProcessor: hook initialized", {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    return () => {
      if (processorRef.current) {
        processorRef.current.reset();
      }
    };
  }, []);
  
  const calculateRMSSD = useCallback((intervals: number[]): number => {
    if (intervals.length < 2) return 0;
    
    // Calculate successive differences
    const successiveDiffs: number[] = [];
    for (let i = 1; i < intervals.length; i++) {
      const diff = Math.abs(intervals[i] - intervals[i - 1]);
      successiveDiffs.push(diff);
    }
    
    // Square the differences
    const squaredDiffs = successiveDiffs.map(diff => diff * diff);
    
    // Calculate mean of squared differences
    const meanSquared = squaredDiffs.reduce((sum, sq) => sum + sq, 0) / squaredDiffs.length;
    
    // Take the square root
    return Math.sqrt(meanSquared);
  }, []);
  
  const detectArrhythmia = useCallback((rmssdValue: number, intervals: number[]): boolean => {
    if (intervals.length < DETECTION_WINDOW_SIZE) return false;
    
    const rrVariability = Math.abs(rmssdValue);
    const isArrhythmic = rrVariability > RMSSD_THRESHOLD;
    
    // Incrementar/resetear contador de arritmias
    const now = Date.now();
    if (isArrhythmic) {
      arrhythmiaCounterRef.current += 1;
      lastArrhythmiaTimeRef.current = now;
    } else if (now - lastArrhythmiaTimeRef.current > ARRHYTHMIA_COUNTER_RESET_MS) {
      // Reset counter after some time without arrhythmias
      arrhythmiaCounterRef.current = 0;
    }
    
    return isArrhythmic;
  }, []);
  
  const processSignal = useCallback((value: number): HeartBeatResult => {
    if (!processorRef.current) {
      throw new Error("Heart beat processor not initialized");
    }
    
    const result = processorRef.current.processSignal(value);
    const rrData = processorRef.current.getRRIntervals();
    
    // Actualizar intervalos RR
    if (rrData && rrData.intervals.length > 0) {
      rrIntervalsRef.current = [...rrData.intervals];
      
      if (rrIntervalsRef.current.length > 1) {
        const currentRmssd = calculateRMSSD(rrIntervalsRef.current.slice(-DETECTION_WINDOW_SIZE));
        setRmssd(currentRmssd);
        
        // Detectar arritmia usando el RMSSD
        const isArrhythmicBeat = detectArrhythmia(currentRmssd, rrIntervalsRef.current);
        setIsArrhythmia(isArrhythmicBeat);
        
        if (rrIntervalsRef.current.length >= 2) {
          const lastInterval = rrIntervalsRef.current[rrIntervalsRef.current.length - 1];
          setLastRRInterval(lastInterval);
        }
      }
    }
    
    return {
      ...result,
      rrData: {
        intervals: rrIntervalsRef.current,
        lastPeakTime: rrData.lastPeakTime
      }
    };
  }, [calculateRMSSD, detectArrhythmia]);
  
  const reset = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.reset();
    }
    rrIntervalsRef.current = [];
    arrhythmiaCounterRef.current = 0;
    setRmssd(0);
    setIsArrhythmia(false);
    setLastRRInterval(0);
  }, []);
  
  return {
    processSignal,
    reset,
    rmssd,
    isArrhythmia,
    lastRRInterval,
    arrhythmiaCounter: arrhythmiaCounterRef.current
  };
};

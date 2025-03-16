import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';
import { toast } from 'sonner';
import { RRAnalysisResult } from './arrhythmia/types';

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
  const MIN_BEEP_INTERVAL_MS = 200; // Further reduced to ensure beeps are more responsive
  
  const lastRRIntervalsRef = useRef<number[]>([]);
  const lastIsArrhythmiaRef = useRef<boolean>(false);
  const currentBeatIsArrhythmiaRef = useRef<boolean>(false);
  
  const expectedNextBeatTimeRef = useRef<number>(0);
  const heartRateVariabilityRef = useRef<number[]>([]);
  const stabilityCounterRef = useRef<number>(0);
  
  const calibrationCounterRef = useRef<number>(0);
  const lastSignalQualityRef = useRef<number>(0);
  
  const consistentBeatsCountRef = useRef<number>(0);
  const lastValidBpmRef = useRef<number>(0);
  const initializedRef = useRef<boolean>(false);

  useEffect(() => {
    console.log('useHeartBeatProcessor: Initializing new processor', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    try {
      if (!processorRef.current) {
        processorRef.current = new HeartBeatProcessor();
        initializedRef.current = true;
        
        if (typeof window !== 'undefined') {
          (window as any).heartBeatProcessor = processorRef.current;
        }
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
        processorRef.current = null;
      }
      
      if (typeof window !== 'undefined') {
        (window as any).heartBeatProcessor = undefined;
      }
    };
  }, []);

  const pendingBeepsQueue = useRef<{time: number, value: number}[]>([]);
  const beepProcessorTimeoutRef = useRef<number | null>(null);

  const processBeepQueue = useCallback(() => {
    if (!processorRef.current || pendingBeepsQueue.current.length === 0) return;
    
    const now = Date.now();
    const oldestBeep = pendingBeepsQueue.current[0];
    
    if (now - lastBeepTimeRef.current >= MIN_BEEP_INTERVAL_MS * 0.7) {
      processorRef.current.playBeep(1.0); // Maximum volume for clearer beeps
      lastBeepTimeRef.current = now;
      pendingBeepsQueue.current.shift();
      
      console.log(`useHeartBeatProcessor: Beep played from queue, ${pendingBeepsQueue.current.length} pending`);
    }
    
    if (pendingBeepsQueue.current.length > 0) {
      if (beepProcessorTimeoutRef.current) {
        clearTimeout(beepProcessorTimeoutRef.current);
      }
      beepProcessorTimeoutRef.current = window.setTimeout(processBeepQueue, MIN_BEEP_INTERVAL_MS * 0.5);
    }
  }, []);

  const requestImmediateBeep = useCallback((value: number) => {
    if (!processorRef.current) return;
    
    const now = Date.now();
    
    if (now - lastBeepTimeRef.current >= MIN_BEEP_INTERVAL_MS * 0.7) {
      processorRef.current.playBeep(1.0); // Maximum volume for clearer beeps
      lastBeepTimeRef.current = now;
      return;
    }
    
    pendingBeepsQueue.current.push({ time: now, value });
    
    if (!beepProcessorTimeoutRef.current) {
      beepProcessorTimeoutRef.current = window.setTimeout(processBeepQueue, MIN_BEEP_INTERVAL_MS * 0.4); // Faster response
    }
  }, [processBeepQueue]);

  const playBeepSound = useCallback(() => {
    if (!processorRef.current) {
      console.warn('useHeartBeatProcessor: Processor not available for beep');
      return;
    }
    
    const now = Date.now();
    
    if (now - lastBeepTimeRef.current < MIN_BEEP_INTERVAL_MS * 0.6) {
      console.log('useHeartBeatProcessor: Beep queued - too soon after last beep');
      pendingBeepsQueue.current.push({ time: now, value: currentBPM });
      
      if (!beepProcessorTimeoutRef.current) {
        beepProcessorTimeoutRef.current = window.setTimeout(
          processBeepQueue, 
          MIN_BEEP_INTERVAL_MS * 0.4 // Faster response
        );
      }
      return;
    }
    
    try {
      const beepSuccess = processorRef.current.playBeep(1.0); // Maximum volume for clearer beeps
      if (beepSuccess) {
        lastBeepTimeRef.current = now;
        consistentBeatsCountRef.current++;
      } else {
        console.warn('useHeartBeatProcessor: Failed to play beep, adding to queue');
        pendingBeepsQueue.current.push({ time: now, value: currentBPM });
        
        if (!beepProcessorTimeoutRef.current) {
          beepProcessorTimeoutRef.current = window.setTimeout(
            processBeepQueue, 
            MIN_BEEP_INTERVAL_MS * 0.4 // Faster response
          );
        }
      }
    } catch (err) {
      console.error('useHeartBeatProcessor: Error playing beep', err);
    }
  }, [currentBPM, processBeepQueue]);

  const detectArrhythmia = useCallback((rrIntervals: number[]): RRAnalysisResult => {
    if (rrIntervals.length < 5) {
      return {
        rmssd: 0,
        rrVariation: 0,
        timestamp: Date.now(),
        isArrhythmia: false
      };
    }
    
    const lastIntervals = rrIntervals.slice(-5);
    const lastInterval = lastIntervals[lastIntervals.length - 1];
    
    const sum = lastIntervals.reduce((a, b) => a + b, 0);
    const mean = sum / lastIntervals.length;
    
    let rmssdSum = 0;
    for (let i = 1; i < lastIntervals.length; i++) {
      const diff = lastIntervals[i] - lastIntervals[i-1];
      rmssdSum += diff * diff;
    }
    const rmssd = Math.sqrt(rmssdSum / (lastIntervals.length - 1));
    
    let thresholdFactor = 0.35;
    if (stabilityCounterRef.current > 15) {
      thresholdFactor = 0.25;
    } else if (stabilityCounterRef.current < 5) {
      thresholdFactor = 0.40;
    }
    
    const variationRatio = Math.abs(lastInterval - mean) / mean;
    const isIrregular = variationRatio > thresholdFactor;
    
    if (!isIrregular) {
      stabilityCounterRef.current++;
    } else {
      stabilityCounterRef.current = Math.max(0, stabilityCounterRef.current - 2);
    }
    
    const isArrhythmia = isIrregular && stabilityCounterRef.current > 8;
    
    heartRateVariabilityRef.current.push(variationRatio);
    if (heartRateVariabilityRef.current.length > 20) {
      heartRateVariabilityRef.current.shift();
    }
    
    return {
      rmssd,
      rrVariation: variationRatio,
      timestamp: Date.now(),
      isArrhythmia
    };
  }, []);

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

    try {
      calibrationCounterRef.current++;
      
      const result = processorRef.current.processSignal(value);
      const rrData = processorRef.current.getRRIntervals();
      const now = Date.now();
      
      if (rrData && rrData.intervals.length > 0) {
        lastRRIntervalsRef.current = [...rrData.intervals];
      }
      
      if (result.isPeak && result.confidence > 0.3) { // Lowered threshold for more sensitivity
        lastPeakTimeRef.current = now;
        
        // Always play beep on peak detection to ensure synchronization with PPG peaks
        requestImmediateBeep(value);
        
        if (result.bpm >= 40 && result.bpm <= 200) {
          lastValidBpmRef.current = result.bpm;
        }
      }
      
      lastSignalQualityRef.current = result.confidence;

      if (result.confidence < 0.15) {
        return {
          bpm: currentBPM,
          confidence: result.confidence,
          isPeak: false,
          arrhythmiaCount: 0,
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
    } catch (error) {
      console.error('useHeartBeatProcessor: Error processing signal', error);
      return {
        bpm: currentBPM,
        confidence: 0,
        isPeak: false,
        arrhythmiaCount: 0,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      };
    }
  }, [currentBPM, confidence, requestImmediateBeep]);

  const reset = useCallback(() => {
    console.log('useHeartBeatProcessor: Resetting processor', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    if (processorRef.current) {
      processorRef.current.reset();
    }
    
    setCurrentBPM(0);
    setConfidence(0);
    lastPeakTimeRef.current = null;
    lastBeepTimeRef.current = 0;
    lastRRIntervalsRef.current = [];
    lastIsArrhythmiaRef.current = false;
    currentBeatIsArrhythmiaRef.current = false;
    expectedNextBeatTimeRef.current = 0;
    heartRateVariabilityRef.current = [];
    stabilityCounterRef.current = 0;
    consistentBeatsCountRef.current = 0;
    lastValidBpmRef.current = 0;
    calibrationCounterRef.current = 0;
    lastSignalQualityRef.current = 0;
  }, []);

  return {
    currentBPM,
    confidence,
    processSignal,
    reset,
    isArrhythmia: currentBeatIsArrhythmiaRef.current,
    requestBeep: requestImmediateBeep
  };
};

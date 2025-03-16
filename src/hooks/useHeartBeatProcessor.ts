import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';
import { toast } from 'sonner';
import { RRAnalysisResult } from './arrhythmia/types';
import { autoCalibrate, adaptProcessorToSignalQuality } from '../utils/displayOptimizer';

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
  const MIN_BEEP_INTERVAL_MS = 250;
  
  const lastRRIntervalsRef = useRef<number[]>([]);
  const lastIsArrhythmiaRef = useRef<boolean>(false);
  const currentBeatIsArrhythmiaRef = useRef<boolean>(false);
  
  const expectedNextBeatTimeRef = useRef<number>(0);
  const heartRateVariabilityRef = useRef<number[]>([]);
  const stabilityCounterRef = useRef<number>(0);
  
  const calibrationCounterRef = useRef<number>(0);
  const lastSignalQualityRef = useRef<number>(0);
  const calibrationCompleteRef = useRef<boolean>(false);
  
  const consistentBeatsCountRef = useRef<number>(0);
  const lastValidBpmRef = useRef<number>(0);
  const initializedRef = useRef<boolean>(false);

  const pendingBeepsQueue = useRef<{time: number, value: number}[]>([]);
  const beepProcessorTimeoutRef = useRef<number | null>(null);
  const beepProcessingActiveRef = useRef<boolean>(false);

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
        
        setTimeout(() => {
          performAutoCalibration();
          const calibrationInterval = setInterval(performAutoCalibration, 30000);
          return () => clearInterval(calibrationInterval);
        }, 5000);
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
      
      if (beepProcessorTimeoutRef.current) {
        clearTimeout(beepProcessorTimeoutRef.current);
        beepProcessorTimeoutRef.current = null;
      }
    };
  }, []);

  const performAutoCalibration = useCallback(() => {
    if (!processorRef.current) return;
    
    try {
      const optimalConfig = autoCalibrate(processorRef.current);
      
      if (optimalConfig) {
        Object.keys(optimalConfig).forEach(key => {
          if (processorRef.current && key in processorRef.current) {
            (processorRef.current as any)[key] = optimalConfig[key];
          }
        });
        
        calibrationCompleteRef.current = true;
        
        console.log('HeartBeatProcessor: Auto-calibration applied successfully', {
          sessionId: sessionId.current,
          timestamp: new Date().toISOString(),
          appliedSettings: optimalConfig
        });
      }
    } catch (error) {
      console.error('Error during auto-calibration:', error);
    }
  }, []);

  const processBeepQueue = useCallback(() => {
    if (!processorRef.current || pendingBeepsQueue.current.length === 0) {
      beepProcessingActiveRef.current = false;
      return;
    }
    
    beepProcessingActiveRef.current = true;
    const now = Date.now();
    
    while (pendingBeepsQueue.current.length > 0) {
      if (now - lastBeepTimeRef.current < MIN_BEEP_INTERVAL_MS * 0.6) {
        break;
      }
      
      const beep = pendingBeepsQueue.current.shift();
      if (beep) {
        processorRef.current.playBeep(0.85);
        lastBeepTimeRef.current = now;
        console.log(`useHeartBeatProcessor: Beep played from queue, ${pendingBeepsQueue.current.length} remaining`);
      }
    }
    
    if (pendingBeepsQueue.current.length > 0) {
      if (beepProcessorTimeoutRef.current) {
        clearTimeout(beepProcessorTimeoutRef.current);
      }
      beepProcessorTimeoutRef.current = window.setTimeout(processBeepQueue, MIN_BEEP_INTERVAL_MS * 0.4);
    } else {
      beepProcessingActiveRef.current = false;
    }
  }, []);

  const requestImmediateBeep = useCallback((value: number) => {
    if (!processorRef.current) return;
    
    const now = Date.now();
    
    if (now - lastBeepTimeRef.current >= MIN_BEEP_INTERVAL_MS * 0.6) {
      processorRef.current.playBeep(0.85);
      lastBeepTimeRef.current = now;
      return;
    }
    
    pendingBeepsQueue.current.push({ time: now, value });
    
    if (!beepProcessingActiveRef.current) {
      if (beepProcessorTimeoutRef.current) {
        clearTimeout(beepProcessorTimeoutRef.current);
      }
      beepProcessorTimeoutRef.current = window.setTimeout(processBeepQueue, MIN_BEEP_INTERVAL_MS * 0.4);
    }
  }, [processBeepQueue]);

  const handleExternalBeepRequest = useCallback((timestamp: number) => {
    if (!processorRef.current) return;
    
    if (processorRef.current.requestBeepForTime && processorRef.current.requestBeepForTime(timestamp)) {
      return;
    }
    
    requestImmediateBeep(0);
  }, [requestImmediateBeep]);

  const playBeepSound = useCallback(() => {
    if (!processorRef.current) {
      console.warn('useHeartBeatProcessor: Processor not available for beep');
      return;
    }
    
    const now = Date.now();
    
    if (now - lastBeepTimeRef.current < MIN_BEEP_INTERVAL_MS * 0.6) {
      console.log('useHeartBeatProcessor: Beep encolado - muy pronto después del último beep');
      pendingBeepsQueue.current.push({ time: now, value: currentBPM });
      
      if (!beepProcessorTimeoutRef.current) {
        beepProcessorTimeoutRef.current = window.setTimeout(
          processBeepQueue, 
          MIN_BEEP_INTERVAL_MS * 0.5
        );
      }
      return;
    }
    
    try {
      const beepSuccess = processorRef.current.playBeep(0.8);
      if (beepSuccess) {
        lastBeepTimeRef.current = now;
        consistentBeatsCountRef.current++;
      } else {
        console.warn('useHeartBeatProcessor: Failed to play beep, adding to queue');
        pendingBeepsQueue.current.push({ time: now, value: currentBPM });
        
        if (!beepProcessorTimeoutRef.current) {
          beepProcessorTimeoutRef.current = window.setTimeout(
            processBeepQueue, 
            MIN_BEEP_INTERVAL_MS * 0.5
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
      thresholdFactor = 0.45;
    }
    
    const variationRatio = Math.abs(lastInterval - mean) / mean;
    const isIrregular = variationRatio > thresholdFactor;
    
    if (!isIrregular) {
      stabilityCounterRef.current++;
    } else {
      stabilityCounterRef.current = Math.max(0, stabilityCounterRef.current - 2);
    }
    
    const isArrhythmia = isIrregular && stabilityCounterRef.current > 10;
    
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
      
      let currentBeatIsArrhythmia = false;
      let analysisResult: RRAnalysisResult = {
        rmssd: 0,
        rrVariation: 0,
        timestamp: now,
        isArrhythmia: false
      };
      
      if (result.isPeak && result.confidence > 0.60 && lastRRIntervalsRef.current.length >= 5) {
        analysisResult = detectArrhythmia(lastRRIntervalsRef.current);
        currentBeatIsArrhythmia = analysisResult.isArrhythmia;
        currentBeatIsArrhythmiaRef.current = currentBeatIsArrhythmia;
        lastIsArrhythmiaRef.current = currentBeatIsArrhythmia;
      }

      if (result.isPeak && result.confidence > 0.5) {
        lastPeakTimeRef.current = now;
        
        requestImmediateBeep(value);
        
        if (result.confidence > 0.70) {
          playBeepSound();
        }
        
        if (result.bpm >= 40 && result.bpm <= 200) {
          lastValidBpmRef.current = result.bpm;
          
          const expectedInterval = 60000 / result.bpm;
          expectedNextBeatTimeRef.current = now + expectedInterval;
        }
      }
      
      lastSignalQualityRef.current = result.confidence;
      
      if (calibrationCompleteRef.current && calibrationCounterRef.current % 50 === 0) {
        adaptProcessorToSignalQuality(processorRef.current, lastSignalQualityRef.current);
      }

      if (result.confidence < 0.25) {
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
  }, [currentBPM, confidence, detectArrhythmia, playBeepSound, requestImmediateBeep]);

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
    calibrationCompleteRef.current = false;
    
    pendingBeepsQueue.current = [];
    if (beepProcessorTimeoutRef.current) {
      clearTimeout(beepProcessorTimeoutRef.current);
      beepProcessorTimeoutRef.current = null;
    }
    beepProcessingActiveRef.current = false;
    
    setTimeout(performAutoCalibration, 3000);
  }, [performAutoCalibration]);

  return {
    currentBPM,
    confidence,
    processSignal,
    reset,
    isArrhythmia: currentBeatIsArrhythmiaRef.current,
    requestBeep: handleExternalBeepRequest
  };
};

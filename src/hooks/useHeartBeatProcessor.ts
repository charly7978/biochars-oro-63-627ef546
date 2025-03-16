
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
  const MIN_BEEP_INTERVAL_MS = 200; // Reduced for more responsive beeps
  
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
  const lastQueuedBeepTimeRef = useRef<number>(0);
  const forceSynchronizedBeepsRef = useRef<boolean>(true);

  useEffect(() => {
    console.log('useHeartBeatProcessor: Initializing new processor', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    try {
      if (!processorRef.current) {
        processorRef.current = new HeartBeatProcessor();
        initializedRef.current = true;
        
        // Set key properties for immediate beeps
        if (processorRef.current) {
          processorRef.current.FORCE_IMMEDIATE_BEEP = true;
          processorRef.current.SKIP_TIMING_VALIDATION = true;
          processorRef.current.MIN_BEEP_INTERVAL_MS = 180; // Reduced minimum interval
        }
        
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
        
        // Ensure immediate beep settings remain after calibration
        if (processorRef.current) {
          processorRef.current.FORCE_IMMEDIATE_BEEP = true;
          processorRef.current.SKIP_TIMING_VALIDATION = true;
          processorRef.current.MIN_BEEP_INTERVAL_MS = 180;
        }
        
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
    
    // Process all beeps that are due
    while (pendingBeepsQueue.current.length > 0) {
      if (now - lastBeepTimeRef.current < MIN_BEEP_INTERVAL_MS * 0.5) {
        break;
      }
      
      const beep = pendingBeepsQueue.current.shift();
      if (beep) {
        if (processorRef.current) {
          try {
            processorRef.current.playBeep(0.9); // Increased volume
            lastBeepTimeRef.current = now;
            console.log(`useHeartBeatProcessor: Beep played from queue at ${now}, ${pendingBeepsQueue.current.length} remaining`);
          } catch (err) {
            console.error('Error playing beep from queue:', err);
          }
        }
      }
    }
    
    // Schedule next queue processing if there are still items
    if (pendingBeepsQueue.current.length > 0) {
      if (beepProcessorTimeoutRef.current) {
        clearTimeout(beepProcessorTimeoutRef.current);
      }
      beepProcessorTimeoutRef.current = window.setTimeout(processBeepQueue, MIN_BEEP_INTERVAL_MS * 0.3);
    } else {
      beepProcessingActiveRef.current = false;
    }
  }, []);

  const requestImmediateBeep = useCallback((value: number) => {
    if (!processorRef.current) return;
    
    const now = Date.now();
    
    // Don't queue beeps too close to each other
    if (now - lastQueuedBeepTimeRef.current < MIN_BEEP_INTERVAL_MS * 0.3) {
      return;
    }
    
    lastQueuedBeepTimeRef.current = now;
    
    // Try direct play first if possible
    if (now - lastBeepTimeRef.current >= MIN_BEEP_INTERVAL_MS * 0.5) {
      try {
        processorRef.current.playBeep(0.9);
        lastBeepTimeRef.current = now;
        return;
      } catch (err) {
        console.error('Error playing immediate beep:', err);
      }
    }
    
    // Queue if direct play not possible
    pendingBeepsQueue.current.push({ time: now, value });
    
    if (!beepProcessingActiveRef.current) {
      if (beepProcessorTimeoutRef.current) {
        clearTimeout(beepProcessorTimeoutRef.current);
      }
      beepProcessorTimeoutRef.current = window.setTimeout(processBeepQueue, MIN_BEEP_INTERVAL_MS * 0.3);
    }
  }, [processBeepQueue]);

  const handleExternalBeepRequest = useCallback((timestamp: number) => {
    if (!processorRef.current) return;
    
    // First try the processor's direct beep method if available
    if (processorRef.current.requestBeepForTime && processorRef.current.requestBeepForTime(timestamp)) {
      return;
    }
    
    // Fall back to our queue system
    requestImmediateBeep(0);
  }, [requestImmediateBeep]);

  const playBeepSound = useCallback(() => {
    if (!processorRef.current) {
      console.warn('useHeartBeatProcessor: Processor not available for beep');
      return;
    }
    
    const now = Date.now();
    
    if (now - lastBeepTimeRef.current < MIN_BEEP_INTERVAL_MS * 0.5) {
      console.log('useHeartBeatProcessor: Beep queued - too soon after last beep');
      pendingBeepsQueue.current.push({ time: now, value: currentBPM });
      
      if (!beepProcessingActiveRef.current) {
        if (beepProcessorTimeoutRef.current) {
          clearTimeout(beepProcessorTimeoutRef.current);
        }
        beepProcessorTimeoutRef.current = window.setTimeout(
          processBeepQueue, 
          MIN_BEEP_INTERVAL_MS * 0.3
        );
      }
      return;
    }
    
    try {
      const beepSuccess = processorRef.current.playBeep(0.9);
      if (beepSuccess) {
        lastBeepTimeRef.current = now;
        consistentBeatsCountRef.current++;
      } else {
        console.warn('useHeartBeatProcessor: Failed to play beep, adding to queue');
        pendingBeepsQueue.current.push({ time: now, value: currentBPM });
        
        if (!beepProcessingActiveRef.current) {
          if (beepProcessorTimeoutRef.current) {
            clearTimeout(beepProcessorTimeoutRef.current);
          }
          beepProcessorTimeoutRef.current = window.setTimeout(
            processBeepQueue, 
            MIN_BEEP_INTERVAL_MS * 0.3
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
        
        // Forcibly play beep for detected peak with high priority
        if (forceSynchronizedBeepsRef.current) {
          requestImmediateBeep(value);
        }
        
        playBeepSound();
        
        if (result.bpm >= 40 && result.bpm <= 200) {
          lastValidBpmRef.current = result.bpm;
          
          const expectedInterval = 60000 / result.bpm;
          expectedNextBeatTimeRef.current = now + expectedInterval;
        }
      }
      
      lastSignalQualityRef.current = result.confidence;
      
      if (calibrationCompleteRef.current && calibrationCounterRef.current % 50 === 0) {
        adaptProcessorToSignalQuality(processorRef.current, lastSignalQualityRef.current);
        
        // Ensure our beep settings remain after adaptation
        if (processorRef.current) {
          processorRef.current.FORCE_IMMEDIATE_BEEP = true;
          processorRef.current.SKIP_TIMING_VALIDATION = true;
          processorRef.current.MIN_BEEP_INTERVAL_MS = 180;
        }
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
      
      // Reset and ensure our beep settings
      processorRef.current.FORCE_IMMEDIATE_BEEP = true;
      processorRef.current.SKIP_TIMING_VALIDATION = true;
      processorRef.current.MIN_BEEP_INTERVAL_MS = 180;
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
    lastQueuedBeepTimeRef.current = 0;
    
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

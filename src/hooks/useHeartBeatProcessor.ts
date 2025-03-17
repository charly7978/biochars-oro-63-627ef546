
import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';
import { toast } from 'sonner';
import { RRAnalysisResult } from './arrhythmia/types';
import { SignalProcessor } from '../modules/vital-signs/signal-processor';

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

// Create a shared SignalProcessor instance for peak detection consistency
const sharedSignalProcessor = new SignalProcessor();

export const useHeartBeatProcessor = () => {
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  const lastPeakTimeRef = useRef<number | null>(null);
  const lastBeepTimeRef = useRef<number>(0);
  const MIN_BEEP_INTERVAL_MS = 250; // Minimum time between beeps
  
  const lastRRIntervalsRef = useRef<number[]>([]);
  const lastIsArrhythmiaRef = useRef<boolean>(false);
  const currentBeatIsArrhythmiaRef = useRef<boolean>(false);
  
  const heartRateVariabilityRef = useRef<number[]>([]);
  const stabilityCounterRef = useRef<number>(0);
  
  const calibrationCounterRef = useRef<number>(0);
  const lastSignalQualityRef = useRef<number>(0);
  
  const consistentBeatsCountRef = useRef<number>(0);
  const lastValidBpmRef = useRef<number>(0);
  const initializedRef = useRef<boolean>(false);
  
  const missedBeepsCounter = useRef<number>(0);
  const isMonitoringRef = useRef<boolean>(false);
  
  // Track consecutive zero signals to detect finger removal
  const consecutiveWeakSignalsRef = useRef<number>(0);
  const WEAK_SIGNAL_THRESHOLD = 0.08; // Threshold to consider a signal weak
  const MAX_CONSECUTIVE_WEAK_SIGNALS = 5; // Number of weak signals to consider finger removed

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
          // Also expose the shared signal processor
          (window as any).sharedSignalProcessor = sharedSignalProcessor;
        }
      }
      
      if (processorRef.current) {
        processorRef.current.initAudio();
        // Ensure monitoring is off by default
        processorRef.current.setMonitoring(false);
        isMonitoringRef.current = false;
      }
      
      // Reset the shared signal processor
      sharedSignalProcessor.reset();
      
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
        // Ensure monitoring is turned off when unmounting
        processorRef.current.setMonitoring(false);
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
    if (!isMonitoringRef.current) {
      // Clear the queue if not monitoring
      pendingBeepsQueue.current = [];
      return;
    }
    
    if (!processorRef.current || pendingBeepsQueue.current.length === 0) return;
    
    // Only process beeps if signal quality is good
    if (lastSignalQualityRef.current < 0.4) {
      pendingBeepsQueue.current = [];
      return;
    }
    
    // Only process beeps if we haven't had too many weak signals
    if (consecutiveWeakSignalsRef.current > MAX_CONSECUTIVE_WEAK_SIGNALS) {
      pendingBeepsQueue.current = [];
      return;
    }
    
    const now = Date.now();
    
    if (now - lastBeepTimeRef.current >= MIN_BEEP_INTERVAL_MS) {
      try {
        // Attempt to play the beep only if monitoring
        if (isMonitoringRef.current) {
          processorRef.current.playBeep(0.7); // Reduced volume
          lastBeepTimeRef.current = now;
        }
        pendingBeepsQueue.current.shift();
        missedBeepsCounter.current = 0; // Reset missed beeps counter
      } catch (err) {
        console.error('Error playing beep from queue:', err);
        pendingBeepsQueue.current.shift(); // Remove failed beep and continue
      }
    }
    
    if (pendingBeepsQueue.current.length > 0) {
      if (beepProcessorTimeoutRef.current) {
        clearTimeout(beepProcessorTimeoutRef.current);
      }
      beepProcessorTimeoutRef.current = window.setTimeout(processBeepQueue, MIN_BEEP_INTERVAL_MS * 0.5);
    }
  }, []);

  // Only add to queue or play beeps if confidence is high and a peak was detected
  const requestImmediateBeep = useCallback((value: number, isPeak: boolean) => {
    if (!isMonitoringRef.current || !processorRef.current) return false;
    
    // Only beep if signal quality is good and we don't have too many weak signals
    if (lastSignalQualityRef.current < 0.4 || 
        consecutiveWeakSignalsRef.current > MAX_CONSECUTIVE_WEAK_SIGNALS) {
      return false;
    }
    
    // IMPORTANT: Only beep if this is a detected peak
    if (!isPeak) return false;
    
    const now = Date.now();
    
    if (now - lastBeepTimeRef.current >= MIN_BEEP_INTERVAL_MS) {
      try {
        const success = processorRef.current.playBeep(0.7);
        
        if (success) {
          lastBeepTimeRef.current = now;
          missedBeepsCounter.current = 0;
          return true;
        } else {
          console.warn('useHeartBeatProcessor: Beep failed to play immediately');
          missedBeepsCounter.current++;
        }
      } catch (err) {
        console.error('Error playing immediate beep:', err);
        missedBeepsCounter.current++;
      }
    } else {
      // Don't add too many beeps to the queue
      if (pendingBeepsQueue.current.length < 3) {
        pendingBeepsQueue.current.push({ time: now, value });
      
        if (!beepProcessorTimeoutRef.current) {
          beepProcessorTimeoutRef.current = window.setTimeout(processBeepQueue, MIN_BEEP_INTERVAL_MS * 0.6);
        }
      }
    }
    
    return false;
  }, [processBeepQueue]);

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
    
    // More strict threshold
    let thresholdFactor = 0.25;
    if (stabilityCounterRef.current > 15) {
      thresholdFactor = 0.20;
    } else if (stabilityCounterRef.current < 5) {
      thresholdFactor = 0.30;
    }
    
    const variationRatio = Math.abs(lastInterval - mean) / mean;
    const isIrregular = variationRatio > thresholdFactor;
    
    if (!isIrregular) {
      stabilityCounterRef.current = Math.min(30, stabilityCounterRef.current + 1);
    } else {
      stabilityCounterRef.current = Math.max(0, stabilityCounterRef.current - 2);
    }
    
    // Require more stability before reporting arrhythmia
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
      
      // Check for weak signal to detect finger removal
      if (Math.abs(value) < WEAK_SIGNAL_THRESHOLD) {
        consecutiveWeakSignalsRef.current++;
        
        // If we've had too many weak signals in a row, reset values
        if (consecutiveWeakSignalsRef.current > MAX_CONSECUTIVE_WEAK_SIGNALS) {
          if (currentBPM > 0) {
            setCurrentBPM(0);
            setConfidence(0);
          }
          
          return {
            bpm: 0,
            confidence: 0,
            isPeak: false,
            arrhythmiaCount: processorRef.current.getArrhythmiaCounter() || 0,
            rrData: {
              intervals: [],
              lastPeakTime: null
            }
          };
        }
      } else {
        // Reset consecutive weak signals counter
        consecutiveWeakSignalsRef.current = 0;
      }
      
      // Don't process signals that are too small (likely noise)
      if (Math.abs(value) < 0.05) {
        return {
          bpm: 0,
          confidence: 0,
          isPeak: false,
          arrhythmiaCount: processorRef.current.getArrhythmiaCounter() || 0,
          rrData: {
            intervals: [],
            lastPeakTime: null
          }
        };
      }
      
      // CRITICAL CHANGE: Add value to shared signal processor first and detect peak
      const isPeak = sharedSignalProcessor.addValue(value);
      
      // Use shared signal processor for consistency
      const heartRate = sharedSignalProcessor.calculateHeartRate();
      
      // Process signal through heart beat processor for additional functionality
      const result = processorRef.current.processSignal(value);
      
      // Use shared signal processor's timing data
      const lastPeakTime = sharedSignalProcessor.getLastPeakTime();
      
      // Update heart rate from shared signal processor
      result.bpm = heartRate > 0 ? heartRate : result.bpm;
      
      // Make sure to correctly mark peak detection
      result.isPeak = isPeak;
      
      const rrData = {
        intervals: processorRef.current.getRRIntervals().intervals,
        lastPeakTime: lastPeakTime
      };
      
      const now = Date.now();
      
      if (rrData && rrData.intervals.length > 0) {
        lastRRIntervalsRef.current = [...rrData.intervals];
      }
      
      // Only process peaks with minimum confidence
      if (isPeak && result.confidence > 0.4) {
        lastPeakTimeRef.current = now;
        
        if (isMonitoringRef.current && result.confidence > 0.5) {
          // Pass peak information to beep function
          requestImmediateBeep(value, true);
        }
        
        if (result.bpm >= 40 && result.bpm <= 200) {
          lastValidBpmRef.current = result.bpm;
        }
      }
      
      lastSignalQualityRef.current = result.confidence;

      // If confidence is very low, don't update values
      if (result.confidence < 0.25) {
        return {
          bpm: currentBPM,
          confidence: result.confidence,
          isPeak: false,
          arrhythmiaCount: processorRef.current.getArrhythmiaCounter() || 0,
          rrData: rrData
        };
      }

      // Update state only with reasonable confidence
      if (result.bpm > 0 && result.confidence > 0.4) {
        setCurrentBPM(result.bpm);
        setConfidence(result.confidence);
      }

      return {
        ...result,
        isArrhythmia: currentBeatIsArrhythmiaRef.current,
        arrhythmiaCount: processorRef.current.getArrhythmiaCounter() || 0,
        rrData: rrData
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
      // Turn off monitoring first
      processorRef.current.setMonitoring(false);
      isMonitoringRef.current = false;
      
      // Then reset the processor
      processorRef.current.reset();
      processorRef.current.initAudio();
      
      // Also reset shared signal processor
      sharedSignalProcessor.reset();
    }
    
    setCurrentBPM(0);
    setConfidence(0);
    lastPeakTimeRef.current = null;
    lastBeepTimeRef.current = 0;
    lastRRIntervalsRef.current = [];
    lastIsArrhythmiaRef.current = false;
    currentBeatIsArrhythmiaRef.current = false;
    heartRateVariabilityRef.current = [];
    stabilityCounterRef.current = 0;
    consistentBeatsCountRef.current = 0;
    lastValidBpmRef.current = 0;
    calibrationCounterRef.current = 0;
    lastSignalQualityRef.current = 0;
    missedBeepsCounter.current = 0;
    consecutiveWeakSignalsRef.current = 0;
    
    // Clear any pending beeps
    pendingBeepsQueue.current = [];
    
    if (beepProcessorTimeoutRef.current) {
      clearTimeout(beepProcessorTimeoutRef.current);
      beepProcessorTimeoutRef.current = null;
    }
  }, []);

  // Function to start monitoring
  const startMonitoring = useCallback(() => {
    console.log('useHeartBeatProcessor: Starting monitoring');
    if (processorRef.current) {
      isMonitoringRef.current = true;
      processorRef.current.setMonitoring(true);
      console.log('HeartBeatProcessor: Monitoring state set to true');
      
      // Reset state counters
      lastPeakTimeRef.current = null;
      lastBeepTimeRef.current = 0;
      pendingBeepsQueue.current = [];
      consecutiveWeakSignalsRef.current = 0;
      
      // Reset shared signal processor
      sharedSignalProcessor.reset();
      
      if (beepProcessorTimeoutRef.current) {
        clearTimeout(beepProcessorTimeoutRef.current);
        beepProcessorTimeoutRef.current = null;
      }
    }
  }, []);

  // Function to stop monitoring
  const stopMonitoring = useCallback(() => {
    console.log('useHeartBeatProcessor: Stopping monitoring');
    if (processorRef.current) {
      isMonitoringRef.current = false;
      processorRef.current.setMonitoring(false);
      console.log('HeartBeatProcessor: Monitoring state set to false');
    }
    
    // Clear any pending beeps
    pendingBeepsQueue.current = [];
    
    if (beepProcessorTimeoutRef.current) {
      clearTimeout(beepProcessorTimeoutRef.current);
      beepProcessorTimeoutRef.current = null;
    }
    
    // Reset BPM values
    setCurrentBPM(0);
    setConfidence(0);
    
    // Reset shared signal processor
    sharedSignalProcessor.reset();
  }, []);

  // Export sharedSignalProcessor for components that need to access it
  return {
    currentBPM,
    confidence,
    processSignal,
    reset,
    isArrhythmia: currentBeatIsArrhythmiaRef.current,
    requestBeep: (value: number) => requestImmediateBeep(value, true),
    startMonitoring,
    stopMonitoring,
    sharedSignalProcessor
  };
};

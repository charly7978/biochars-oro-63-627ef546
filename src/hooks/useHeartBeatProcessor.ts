
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
  // State management
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  // References for precise beep synchronization
  const lastPeakTimeRef = useRef<number | null>(null);
  const lastBeepTimeRef = useRef<number>(0);
  const MIN_BEEP_INTERVAL_MS = 450; // Increased minimum interval for more natural rhythm
  
  // References for arrhythmia analysis
  const lastRRIntervalsRef = useRef<number[]>([]);
  const lastIsArrhythmiaRef = useRef<boolean>(false);
  const currentBeatIsArrhythmiaRef = useRef<boolean>(false);
  
  // References for natural synchronization
  const expectedNextBeatTimeRef = useRef<number>(0);
  const heartRateVariabilityRef = useRef<number[]>([]);
  const stabilityCounterRef = useRef<number>(0);
  
  // References for improved beep reliability
  const consistentBeatsCountRef = useRef<number>(0);
  const lastValidBpmRef = useRef<number>(0);
  const beepPendingRef = useRef<boolean>(false);
  const initializedRef = useRef<boolean>(false);

  // Initialize the processor
  useEffect(() => {
    console.log('useHeartBeatProcessor: Initializing new processor', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    try {
      // Create new processor instance if needed
      if (!processorRef.current) {
        processorRef.current = new HeartBeatProcessor();
        initializedRef.current = true;
        
        // Expose for debugging if needed
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

  // Function to play beep sound with natural synchronization
  const playBeepSound = useCallback(() => {
    if (!processorRef.current) {
      console.warn('useHeartBeatProcessor: Processor not available for beep');
      return;
    }
    
    const now = Date.now();
    
    // Enforce minimum interval between beeps
    if (now - lastBeepTimeRef.current < MIN_BEEP_INTERVAL_MS) {
      console.log('useHeartBeatProcessor: Beep rejected - too soon after last beep');
      return;
    }
    
    // Only beep with valid BPM
    if (currentBPM < 40 || currentBPM > 200) {
      console.log('useHeartBeatProcessor: Beep rejected - invalid BPM range');
      return;
    }
    
    try {
      // Play beep with appropriate volume
      const beepSuccess = processorRef.current.playBeep(0.7);
      if (beepSuccess) {
        console.log(`useHeartBeatProcessor: Beep played successfully - BPM: ${currentBPM}`);
        lastBeepTimeRef.current = now;
        beepPendingRef.current = false;
        consistentBeatsCountRef.current++;
      } else {
        console.warn('useHeartBeatProcessor: Failed to play beep');
      }
    } catch (err) {
      console.error('useHeartBeatProcessor: Error playing beep', err);
    }
  }, [currentBPM]);

  // Improved arrhythmia detection algorithm
  const detectArrhythmia = useCallback((rrIntervals: number[]): RRAnalysisResult => {
    // Require sufficient data for reliable detection
    if (rrIntervals.length < 5) {
      return {
        rmssd: 0,
        rrVariation: 0,
        timestamp: Date.now(),
        isArrhythmia: false
      };
    }
    
    // Use recent intervals for analysis
    const lastIntervals = rrIntervals.slice(-5);
    const lastInterval = lastIntervals[lastIntervals.length - 1];
    
    // Statistical calculation
    const sum = lastIntervals.reduce((a, b) => a + b, 0);
    const mean = sum / lastIntervals.length;
    
    // RMSSD calculation (standard HRV measure)
    let rmssdSum = 0;
    for (let i = 1; i < lastIntervals.length; i++) {
      const diff = lastIntervals[i] - lastIntervals[i-1];
      rmssdSum += diff * diff;
    }
    const rmssd = Math.sqrt(rmssdSum / (lastIntervals.length - 1));
    
    // Adaptive threshold based on stability
    let thresholdFactor = 0.35; // Default threshold
    if (stabilityCounterRef.current > 15) {
      // More sensitive with high stability
      thresholdFactor = 0.25;
    } else if (stabilityCounterRef.current < 5) {
      // Less sensitive at start
      thresholdFactor = 0.45;
    }
    
    // Arrhythmia criteria - adjusted to minimize false positives
    const variationRatio = Math.abs(lastInterval - mean) / mean;
    const isIrregular = variationRatio > thresholdFactor;
    
    // Update stability counters
    if (!isIrregular) {
      stabilityCounterRef.current++;
    } else {
      stabilityCounterRef.current = Math.max(0, stabilityCounterRef.current - 2);
    }
    
    // Only consider arrhythmia with sufficient stability history
    const isArrhythmia = isIrregular && stabilityCounterRef.current > 10;
    
    // Save variability for future analysis
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

  // Process input signal
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
      // Process signal
      const result = processorRef.current.processSignal(value);
      const rrData = processorRef.current.getRRIntervals();
      const now = Date.now();
      
      // Update RR intervals
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
      
      // Check for arrhythmia only with sufficient confidence
      if (result.isPeak && result.confidence > 0.60 && lastRRIntervalsRef.current.length >= 5) {
        analysisResult = detectArrhythmia(lastRRIntervalsRef.current);
        currentBeatIsArrhythmia = analysisResult.isArrhythmia;
        currentBeatIsArrhythmiaRef.current = currentBeatIsArrhythmia;
        lastIsArrhythmiaRef.current = currentBeatIsArrhythmia;
      }

      // Handle peak detection (already managed by processor's playBeep)
      if (result.isPeak && result.confidence > 0.60) {
        lastPeakTimeRef.current = now;
        
        // Update valid BPM
        if (result.bpm >= 40 && result.bpm <= 200) {
          lastValidBpmRef.current = result.bpm;
          
          // Calculate expected next beat time for natural rhythm
          const expectedInterval = 60000 / result.bpm;
          expectedNextBeatTimeRef.current = now + expectedInterval;
        }
      }

      // With low confidence, maintain previous values
      if (result.confidence < 0.25) {
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

      // Update BPM with valid values
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
  }, [currentBPM, confidence, detectArrhythmia]);

  // Reset processor
  const reset = useCallback(() => {
    console.log('useHeartBeatProcessor: Resetting processor', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    if (processorRef.current) {
      processorRef.current.reset();
    }
    
    // Reset all state values
    setCurrentBPM(0);
    setConfidence(0);
    lastPeakTimeRef.current = null;
    lastBeepTimeRef.current = 0;
    lastRRIntervalsRef.current = [];
    lastIsArrhythmiaRef.current = false;
    currentBeatIsArrhythmiaRef.current = false;
    expectedNextBeatTimeRef.current = 0;
    heartRateVariabilityRef.current = [];
    beepPendingRef.current = false;
    stabilityCounterRef.current = 0;
    consistentBeatsCountRef.current = 0;
    lastValidBpmRef.current = 0;
  }, []);

  return {
    currentBPM,
    confidence,
    processSignal,
    reset,
    isArrhythmia: currentBeatIsArrhythmiaRef.current
  };
};

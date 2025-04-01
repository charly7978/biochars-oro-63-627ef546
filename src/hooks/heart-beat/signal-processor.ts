
import { useCallback, useRef } from 'react';
import { HeartBeatResult } from './types';
import { HeartBeatConfig } from '../../modules/heart-beat/config';
import { 
  checkWeakSignal, 
  shouldProcessMeasurement, 
  createWeakSignalResult
} from './signal-processing';

// New helper function for validation
function isValidPeak(currentTime: number, lastPeakTime: number | null): boolean {
  if (!lastPeakTime) return true;
  
  // Enforce minimum time between peaks
  return (currentTime - lastPeakTime) >= HeartBeatConfig.MIN_PEAK_TIME_MS;
}

// New helper function to handle peak detection with validation
export function handlePeakDetection(
  result: any,
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  requestImmediateBeep: (value: number) => boolean,
  isMonitoringRef: React.MutableRefObject<boolean>,
  value: number
): void {
  if (!result.isPeak) return;
  
  const now = Date.now();
  
  // Validate proper timing between peaks to prevent rapid beeping
  if (isValidPeak(now, lastPeakTimeRef.current)) {
    lastPeakTimeRef.current = now;
    
    // Only request beep if we're monitoring and have a valid peak
    if (isMonitoringRef.current && result.confidence > HeartBeatConfig.MIN_CONFIDENCE) {
      requestImmediateBeep(value);
    }
  }
}

// New helper function for updating last valid BPM
export function updateLastValidBpm(
  result: any,
  lastValidBpmRef: React.MutableRefObject<number>
): void {
  // Only update if we have a reasonable BPM value with good confidence
  if (result.bpm >= HeartBeatConfig.MIN_BPM && 
      result.bpm <= HeartBeatConfig.MAX_BPM &&
      result.confidence > HeartBeatConfig.MIN_CONFIDENCE) {
    lastValidBpmRef.current = result.bpm;
  }
}

// New helper function for processing low confidence results
export function processLowConfidenceResult(
  result: any,
  currentBPM: number,
  arrhythmiaCounter: number
): HeartBeatResult {
  // If confidence is too low, don't update BPM value
  if (result.confidence < HeartBeatConfig.MIN_CONFIDENCE * 0.8) {
    return {
      ...result,
      bpm: currentBPM > 0 ? currentBPM : result.bpm,
      arrhythmiaCount: arrhythmiaCounter
    };
  }
  
  return {
    ...result,
    arrhythmiaCount: arrhythmiaCounter
  };
}

export function useSignalProcessor() {
  const lastPeakTimeRef = useRef<number | null>(null);
  const consistentBeatsCountRef = useRef<number>(0);
  const lastValidBpmRef = useRef<number>(0);
  const calibrationCounterRef = useRef<number>(0);
  const lastSignalQualityRef = useRef<number>(0);
  
  // Signal quality detection with higher thresholds
  const consecutiveWeakSignalsRef = useRef<number>(0);
  const WEAK_SIGNAL_THRESHOLD = HeartBeatConfig.LOW_SIGNAL_THRESHOLD; 
  const MAX_CONSECUTIVE_WEAK_SIGNALS = HeartBeatConfig.LOW_SIGNAL_FRAMES;

  const processSignal = useCallback((
    value: number,
    currentBPM: number,
    confidence: number,
    processor: any,
    requestBeep: (value: number) => boolean,
    isMonitoringRef: React.MutableRefObject<boolean>,
    lastRRIntervalsRef: React.MutableRefObject<number[]>,
    currentBeatIsArrhythmiaRef: React.MutableRefObject<boolean>
  ): HeartBeatResult => {
    if (!processor) {
      return createWeakSignalResult();
    }

    try {
      calibrationCounterRef.current++;
      
      // Check for weak signal with more stringent criteria
      const { isWeakSignal, updatedWeakSignalsCount } = checkWeakSignal(
        value, 
        consecutiveWeakSignalsRef.current, 
        {
          lowSignalThreshold: WEAK_SIGNAL_THRESHOLD,
          maxWeakSignalCount: MAX_CONSECUTIVE_WEAK_SIGNALS
        }
      );
      
      consecutiveWeakSignalsRef.current = updatedWeakSignalsCount;
      
      if (isWeakSignal) {
        return createWeakSignalResult(processor.getArrhythmiaCounter());
      }
      
      // Only process signals with sufficient amplitude
      if (!shouldProcessMeasurement(value)) {
        return createWeakSignalResult(processor.getArrhythmiaCounter());
      }
      
      // Process real signal with maximum peak time enforcement
      const now = Date.now();
      if (lastPeakTimeRef.current && (now - lastPeakTimeRef.current) < HeartBeatConfig.MIN_PEAK_TIME_MS) {
        // Skip processing if too soon after last peak
        return {
          bpm: currentBPM,
          confidence: 0,
          isPeak: false,
          arrhythmiaCount: processor.getArrhythmiaCounter(),
          rrData: {
            intervals: [],
            lastPeakTime: lastPeakTimeRef.current
          }
        };
      }
      
      // Process signal with stricter validation
      const result = processor.processSignal(value);
      const rrData = processor.getRRIntervals();
      
      if (rrData && rrData.intervals.length > 0) {
        lastRRIntervalsRef.current = [...rrData.intervals];
      }
      
      // Handle peak detection with proper timing validation
      handlePeakDetection(
        result, 
        lastPeakTimeRef, 
        requestBeep, 
        isMonitoringRef,
        value
      );
      
      // Update last valid BPM if reasonable
      updateLastValidBpm(result, lastValidBpmRef);
      
      lastSignalQualityRef.current = result.confidence;

      // Process low confidence results
      return processLowConfidenceResult(
        result, 
        currentBPM, 
        processor.getArrhythmiaCounter()
      );
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
  }, []);

  const reset = useCallback(() => {
    lastPeakTimeRef.current = null;
    consistentBeatsCountRef.current = 0;
    lastValidBpmRef.current = 0;
    calibrationCounterRef.current = 0;
    lastSignalQualityRef.current = 0;
    consecutiveWeakSignalsRef.current = 0;
  }, []);

  return {
    processSignal,
    reset,
    lastPeakTimeRef,
    lastValidBpmRef,
    lastSignalQualityRef,
    consecutiveWeakSignalsRef,
    MAX_CONSECUTIVE_WEAK_SIGNALS
  };
}


import { useCallback, useRef } from 'react';
import { HeartBeatResult } from './types';
import { checkSignalQuality } from '../../modules/heart-beat/signal-quality';
import { HeartBeatConfig } from '../../modules/heart-beat/config';

export function useSignalProcessor() {
  const lastPeakTimeRef = useRef<number | null>(null);
  const consistentBeatsCountRef = useRef<number>(0);
  const lastValidBpmRef = useRef<number>(0);
  const calibrationCounterRef = useRef<number>(0);
  const lastSignalQualityRef = useRef<number>(0);
  
  // Track consecutive zero signals to detect finger removal
  const consecutiveWeakSignalsRef = useRef<number>(0);
  const WEAK_SIGNAL_THRESHOLD = HeartBeatConfig.LOW_SIGNAL_THRESHOLD; 
  const MAX_CONSECUTIVE_WEAK_SIGNALS = HeartBeatConfig.LOW_SIGNAL_FRAMES;

  const processSignal = useCallback((
    value: number,
    currentBPM: number,
    confidence: number,
    processor: any,
    requestImmediateBeep: (value: number) => boolean,
    isMonitoringRef: React.MutableRefObject<boolean>,
    lastRRIntervalsRef: React.MutableRefObject<number[]>,
    currentBeatIsArrhythmiaRef: React.MutableRefObject<boolean>
  ): HeartBeatResult => {
    if (!processor) {
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
      
      // Check for weak signal using the centralized function
      const { isWeakSignal, updatedWeakSignalsCount } = checkSignalQuality(
        value, 
        consecutiveWeakSignalsRef.current, 
        {
          lowSignalThreshold: WEAK_SIGNAL_THRESHOLD,
          maxWeakSignalCount: MAX_CONSECUTIVE_WEAK_SIGNALS
        }
      );
      
      consecutiveWeakSignalsRef.current = updatedWeakSignalsCount;
      
      if (isWeakSignal) {
        return {
          bpm: 0,
          confidence: 0,
          isPeak: false,
          arrhythmiaCount: processor.getArrhythmiaCounter() || 0,
          rrData: {
            intervals: [],
            lastPeakTime: null
          }
        };
      }
      
      // Don't process signals that are too small (likely noise)
      if (Math.abs(value) < 0.05) {
        return {
          bpm: 0,
          confidence: 0,
          isPeak: false,
          arrhythmiaCount: processor.getArrhythmiaCounter() || 0,
          rrData: {
            intervals: [],
            lastPeakTime: null
          }
        };
      }
      
      const result = processor.processSignal(value);
      const rrData = processor.getRRIntervals();
      const now = Date.now();
      
      if (rrData && rrData.intervals.length > 0) {
        lastRRIntervalsRef.current = [...rrData.intervals];
      }
      
      // Only process peaks with minimum confidence
      if (result.isPeak && result.confidence > 0.4) {
        lastPeakTimeRef.current = now;
        
        if (isMonitoringRef.current && result.confidence > 0.5) {
          requestImmediateBeep(value);
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
          arrhythmiaCount: processor.getArrhythmiaCounter() || 0,
          rrData: {
            intervals: [],
            lastPeakTime: null
          }
        };
      }

      return {
        ...result,
        isArrhythmia: currentBeatIsArrhythmiaRef.current,
        arrhythmiaCount: processor.getArrhythmiaCounter() || 0,
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

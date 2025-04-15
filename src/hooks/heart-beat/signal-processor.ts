
import { useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../../modules/HeartBeatProcessor';
import { HeartBeatResult } from './types';

export const useSignalProcessor = () => {
  const lastPeakTimeRef = useRef<number | null>(null);
  const lastValidBpmRef = useRef<number>(0);
  const lastSignalQualityRef = useRef<number>(0);
  const consecutiveWeakSignalsRef = useRef<number>(0);
  const MAX_CONSECUTIVE_WEAK_SIGNALS = 5;

  const processSignal = useCallback(
    (
      value: number,
      currentBPM: number,
      confidence: number,
      processor: HeartBeatProcessor,
      requestBeep: (value: number) => boolean,
      isMonitoringRef: React.MutableRefObject<boolean>,
      lastRRIntervalsRef: React.MutableRefObject<number[]>,
      currentBeatIsArrhythmiaRef: React.MutableRefObject<boolean>
    ): HeartBeatResult => {
      const result = processor.processSignal(value);
      
      // Update the signal quality metrics
      const signalQuality = result.confidence;
      lastSignalQualityRef.current = signalQuality;
      
      // Handle peaks for beep sounds
      if (result.isPeak) {
        lastPeakTimeRef.current = Date.now();
        
        // Request sound beep for the peak (though normally handled by PPGSignalMeter)
        if (isMonitoringRef.current) {
          requestBeep(value);
        }
        
        // Get RR interval data for arrhythmia detection
        const rrData = processor.getRRIntervals();
        if (rrData.intervals.length > 0) {
          lastRRIntervalsRef.current = [...rrData.intervals];
          if (lastRRIntervalsRef.current.length > 10) {
            lastRRIntervalsRef.current = lastRRIntervalsRef.current.slice(-10);
          }
        }
      }
      
      // Check for weak signal
      if (result.confidence < 0.3) {
        consecutiveWeakSignalsRef.current++;
        if (consecutiveWeakSignalsRef.current > MAX_CONSECUTIVE_WEAK_SIGNALS) {
          // Reset BPM if signal is consistently weak
          if (lastValidBpmRef.current > 0) {
            result.bpm = 0;
            lastValidBpmRef.current = 0;
          }
        }
      } else {
        consecutiveWeakSignalsRef.current = 0;
        if (result.bpm > 40 && result.bpm < 200) {
          lastValidBpmRef.current = result.bpm;
        }
      }
      
      // Ensure we include RR data in the result
      const heartBeatResult: HeartBeatResult = {
        ...result,
        isArrhythmia: currentBeatIsArrhythmiaRef.current,
        rrData: processor.getRRIntervals()
      };
      
      return heartBeatResult;
    },
    []
  );

  const reset = useCallback(() => {
    lastPeakTimeRef.current = null;
    lastValidBpmRef.current = 0;
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
};

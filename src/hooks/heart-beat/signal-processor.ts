
import { useCallback, useRef } from 'react';
import { HeartBeatResult } from './types';
import { HeartBeatConfig } from '../../modules/heart-beat/config';
import { 
  checkWeakSignal, 
  shouldProcessMeasurement, 
  createWeakSignalResult, 
  getChannelFeedback
} from './signal-processing/signal-quality';

// Signal processing utility functions
import { handlePeakDetection } from './signal-processing/peak-detection';
import { 
  updateLastValidBpm, 
  processLowConfidenceResult 
} from './signal-processing/result-processor';

export function useSignalProcessor() {
  const lastPeakTimeRef = useRef<number | null>(null);
  const consistentBeatsCountRef = useRef<number>(0);
  const lastValidBpmRef = useRef<number>(0);
  const calibrationCounterRef = useRef<number>(0);
  const lastSignalQualityRef = useRef<number>(0);
  
  // Simple reference counter for compatibility
  const consecutiveWeakSignalsRef = useRef<number>(0);
  const WEAK_SIGNAL_THRESHOLD = HeartBeatConfig.LOW_SIGNAL_THRESHOLD; 
  const MAX_CONSECUTIVE_WEAK_SIGNALS = HeartBeatConfig.LOW_SIGNAL_FRAMES;

  // Channel feedback state
  const channelFeedbackRef = useRef<{
    heartRate: { applied: boolean, lastValue: number, time: number },
    spo2: { applied: boolean, lastValue: number, time: number },
    arrhythmia: { applied: boolean, lastValue: number, time: number }
  }>({
    heartRate: { applied: false, lastValue: 0, time: 0 },
    spo2: { applied: false, lastValue: 0, time: 0 },
    arrhythmia: { applied: false, lastValue: 0, time: 0 }
  });

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
      return createWeakSignalResult();
    }

    try {
      calibrationCounterRef.current++;
      
      // Check for bidirectional feedback from other channels
      const heartRateFeedback = getChannelFeedback('heartRate');
      if (heartRateFeedback.available) {
        // Apply channel feedback to improve detection quality
        value = value * (1 + heartRateFeedback.quality * 0.2);
        channelFeedbackRef.current.heartRate = {
          applied: true,
          lastValue: heartRateFeedback.value,
          time: Date.now()
        };
      }
      
      // Check for weak signal - fixed property access
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
      
      // Process real signal
      const result = processor.processSignal(value);
      const rrData = processor.getRRIntervals();
      
      if (rrData && rrData.intervals.length > 0) {
        lastRRIntervalsRef.current = [...rrData.intervals];
      }
      
      // Handle peak detection
      handlePeakDetection(
        result, 
        lastPeakTimeRef, 
        requestImmediateBeep, 
        isMonitoringRef,
        value
      );
      
      // Update last valid BPM if it's reasonable
      updateLastValidBpm(result, lastValidBpmRef);
      
      lastSignalQualityRef.current = result.confidence;

      // Process result
      return processLowConfidenceResult(
        result, 
        currentBPM, 
        processor.getArrhythmiaCounter()
      );
    } catch (error) {
      console.error('useSignalProcessor: Error processing signal', error);
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
    
    // Reset channel feedback
    channelFeedbackRef.current = {
      heartRate: { applied: false, lastValue: 0, time: 0 },
      spo2: { applied: false, lastValue: 0, time: 0 },
      arrhythmia: { applied: false, lastValue: 0, time: 0 }
    };
  }, []);

  return {
    processSignal,
    reset,
    lastPeakTimeRef,
    lastValidBpmRef,
    lastSignalQualityRef,
    consecutiveWeakSignalsRef,
    MAX_CONSECUTIVE_WEAK_SIGNALS,
    channelFeedback: channelFeedbackRef.current
  };
}

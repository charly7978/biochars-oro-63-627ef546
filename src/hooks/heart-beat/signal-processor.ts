
import { useCallback, useRef } from 'react';
import { HeartBeatResult } from './types';
import { HeartBeatConfig } from '../../modules/heart-beat/config';
import { 
  checkWeakSignal, 
  shouldProcessMeasurement, 
  createWeakSignalResult, 
  handlePeakDetection,
  updateLastValidBpm,
  processLowConfidenceResult
} from './signal-processing';

export function useSignalProcessor() {
  const lastPeakTimeRef = useRef<number | null>(null);
  const consistentBeatsCountRef = useRef<number>(0);
  const lastValidBpmRef = useRef<number>(0);
  const calibrationCounterRef = useRef<number>(0);
  const lastSignalQualityRef = useRef<number>(0);
  
  // Track consecutive weak signals for finger detection
  const consecutiveWeakSignalsRef = useRef<number>(0);
  const WEAK_SIGNAL_THRESHOLD = HeartBeatConfig.LOW_SIGNAL_THRESHOLD; 
  const MAX_CONSECUTIVE_WEAK_SIGNALS = HeartBeatConfig.LOW_SIGNAL_FRAMES;
  
  // Add buffer for peak detection to reduce false positives
  const recentPeaksRef = useRef<{time: number, value: number}[]>([]);
  const MAX_PEAKS_BUFFER = 10;
  const MIN_PEAK_INTERVAL_MS = 600; // Increased from default to reduce false positives

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
      
      // Check for weak real signal with enhanced criteria
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
      
      // Add amplitude check to further reduce false positives
      if (!shouldProcessMeasurement(value) || Math.abs(value) < 0.08) {
        return createWeakSignalResult(processor.getArrhythmiaCounter());
      }
      
      // Process real signal
      const result = processor.processSignal(value);
      const rrData = processor.getRRIntervals();
      const now = Date.now();
      
      if (rrData && rrData.intervals.length > 0) {
        lastRRIntervalsRef.current = [...rrData.intervals];
      }
      
      // Add peak validation to reduce false positives
      if (result.isPeak) {
        // Check if this peak is too close to previous peaks (false positive check)
        const tooCloseToExistingPeak = recentPeaksRef.current.some(
          peak => now - peak.time < MIN_PEAK_INTERVAL_MS
        );
        
        if (tooCloseToExistingPeak) {
          // Likely a false positive, suppress this peak
          result.isPeak = false;
          result.confidence = Math.max(0, result.confidence - 0.3);
        } else {
          // Valid peak, add to our buffer
          recentPeaksRef.current.push({ time: now, value });
          if (recentPeaksRef.current.length > MAX_PEAKS_BUFFER) {
            recentPeaksRef.current.shift();
          }
        }
      }
      
      // Handle peak detection based on real signal with validated peaks
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

      // Process result with enhanced confidence criteria
      return processLowConfidenceResult(
        result, 
        currentBPM, 
        processor.getArrhythmiaCounter(),
        0.65 // Increased confidence threshold for more reliable detection
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
    recentPeaksRef.current = [];
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

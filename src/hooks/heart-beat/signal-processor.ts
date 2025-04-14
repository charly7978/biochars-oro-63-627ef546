import { useCallback, useRef } from 'react';
import { HeartBeatResult } from './types';
import { useBeepProcessor } from './beep-processor';
import { calculateAmplitude, findPeaksAndValleys } from '../../modules/vital-signs/utils/peak-detection-utils';
import { shouldProcessMeasurement, createWeakSignalResult, handlePeakDetection } from './signal-processing/peak-detection';
import { detectPeak, confirmPeak } from '../../modules/heart-beat/peak-detector';

export function useSignalProcessor() {
  const signalBufferRef = useRef<number[]>([]);
  const processedValuesRef = useRef<number[]>([]);
  const lastValidBpmRef = useRef<number>(0);
  const lastSignalQualityRef = useRef<number>(0);
  const consecutiveWeakSignalsRef = useRef<number>(0);
  const lastPeakTimeRef = useRef<number | null>(null);
  const lastConfirmedPeakRef = useRef<boolean>(false);
  const peakConfirmationBufferRef = useRef<number[]>([]);
  const lastValueRef = useRef<number>(0);
  const lastDerivativeRef = useRef<number>(0);
  const baselineRef = useRef<number>(0);
  const rmssdHistoryRef = useRef<number[]>([]);
  const peakIndexHistoryRef = useRef<number[]>([]);
  
  const MAX_CONSECUTIVE_WEAK_SIGNALS = 15;
  const MIN_CONFIDENCE_THRESHOLD = 0.4;
  const SIGNAL_THRESHOLD = 0.45;
  const DERIVATIVE_THRESHOLD = 0.02;
  const MIN_PEAK_TIME_MS = 300;
  
  const {
    requestImmediateBeep,
    processBeepQueue,
    pendingBeepsQueue,
    lastBeepTimeRef,
    beepProcessorTimeoutRef,
    cleanup: cleanupBeepProcessor
  } = useBeepProcessor();
  
  const processSignal = useCallback((
    value: number,
    currentBPM: number,
    currentConfidence: number,
    processorRef: any,
    requestBeepCallback: (value: number) => boolean,
    isMonitoringRef: React.MutableRefObject<boolean>,
    lastRRIntervalsRef: React.MutableRefObject<number[]>,
    currentBeatIsArrhythmiaRef: React.MutableRefObject<boolean>
  ): HeartBeatResult => {
    // Check if we should process this measurement
    if (!shouldProcessMeasurement(value)) {
      consecutiveWeakSignalsRef.current++;
      if (consecutiveWeakSignalsRef.current > MAX_CONSECUTIVE_WEAK_SIGNALS) {
        return createWeakSignalResult(0);
      }
      return {
        bpm: lastValidBpmRef.current,
        confidence: Math.max(0, currentConfidence - 0.1),
        isPeak: false,
        arrhythmiaCount: 0,
        rrData: {
          intervals: lastRRIntervalsRef.current,
          lastPeakTime: lastPeakTimeRef.current
        }
      };
    }
    
    // Reset weak signal counter when we get a good signal
    consecutiveWeakSignalsRef.current = 0;
    
    // Add to signal buffer
    signalBufferRef.current.push(value);
    if (signalBufferRef.current.length > 60) {
      signalBufferRef.current.shift();
    }
    
    // Process the signal with moving average
    let processedValue = value;
    if (signalBufferRef.current.length >= 3) {
      const lastThree = signalBufferRef.current.slice(-3);
      processedValue = lastThree.reduce((a, b) => a + b, 0) / 3;
    }
    
    processedValuesRef.current.push(processedValue);
    if (processedValuesRef.current.length > 30) {
      processedValuesRef.current.shift();
    }
    
    // Update baseline (adaptive)
    baselineRef.current = 0.95 * baselineRef.current + 0.05 * processedValue;
    
    // Calculate derivative and normalized value - critical for detecting true peaks
    const normalizedValue = processedValue - baselineRef.current;
    
    // Calculate derivative (using difference between current and previous)
    const derivative = processedValue - lastValueRef.current;
    lastValueRef.current = processedValue;
    lastDerivativeRef.current = derivative;
    
    // Signal quality based on amplitude
    let signalQuality = 0;
    if (processedValuesRef.current.length >= 10) {
      const { peakIndices, valleyIndices } = findPeaksAndValleys(processedValuesRef.current);
      const amplitude = calculateAmplitude(processedValuesRef.current, peakIndices, valleyIndices);
      signalQuality = Math.min(100, Math.max(0, amplitude * 100));
    }
    lastSignalQualityRef.current = signalQuality;
    
    // Detect peak - these parameters are critical for accurate peak detection
    // Peak should be detected on the maximum of the PPG wave (systole) not the minimum
    const { isPeak, confidence } = detectPeak(
      normalizedValue,
      derivative,
      baselineRef.current,
      lastValueRef.current,
      lastPeakTimeRef.current,
      Date.now(),
      {
        minPeakTimeMs: MIN_PEAK_TIME_MS,
        derivativeThreshold: DERIVATIVE_THRESHOLD,
        signalThreshold: SIGNAL_THRESHOLD
      }
    );
    
    // Confirm peak to reduce false positives
    const { 
      isConfirmedPeak, 
      updatedBuffer, 
      updatedLastConfirmedPeak 
    } = confirmPeak(
      isPeak,
      normalizedValue,
      lastConfirmedPeakRef.current,
      peakConfirmationBufferRef.current,
      MIN_CONFIDENCE_THRESHOLD,
      confidence
    );
    
    peakConfirmationBufferRef.current = updatedBuffer;
    lastConfirmedPeakRef.current = updatedLastConfirmedPeak;
    
    // Process peak detection for timing and beeps
    if (isConfirmedPeak) {
      // This is a true heartbeat peak - play sound only here
      if (isMonitoringRef.current) {
        // Play beep on confirmed peak (real heartbeat)
        requestBeepCallback(Math.min(1.0, Math.max(0.5, confidence)));
      }
      
      // Update peak time for BPM calculation
      const now = Date.now();
      if (lastPeakTimeRef.current !== null) {
        const interval = now - lastPeakTimeRef.current;
        
        // Only use physiologically plausible intervals (30-240 BPM)
        if (interval >= 250 && interval <= 2000) {
          lastRRIntervalsRef.current.push(interval);
          
          // Keep only the last 8 intervals
          if (lastRRIntervalsRef.current.length > 8) {
            lastRRIntervalsRef.current.shift();
          }
          
          // Calculate BPM from intervals
          if (lastRRIntervalsRef.current.length >= 2) {
            const avgInterval = lastRRIntervalsRef.current.reduce((a, b) => a + b, 0) / 
                               lastRRIntervalsRef.current.length;
            const newBpm = Math.round(60000 / avgInterval);
            
            // Only update if within physiological range
            if (newBpm >= 30 && newBpm <= 240) {
              lastValidBpmRef.current = newBpm;
            }
          }
        }
      }
      
      // Update last peak time
      lastPeakTimeRef.current = now;
      
      // Handle peak detection for visualization and feedback
      handlePeakDetection(
        { isPeak: true, confidence },
        lastPeakTimeRef,
        requestBeepCallback,
        isMonitoringRef,
        value
      );
    }
    
    return {
      bpm: lastValidBpmRef.current,
      confidence: confidence,
      isPeak: isConfirmedPeak,
      arrhythmiaCount: 0,
      rrData: {
        intervals: lastRRIntervalsRef.current,
        lastPeakTime: lastPeakTimeRef.current
      }
    };
  }, [
    MAX_CONSECUTIVE_WEAK_SIGNALS,
    MIN_CONFIDENCE_THRESHOLD,
    SIGNAL_THRESHOLD,
    DERIVATIVE_THRESHOLD,
    MIN_PEAK_TIME_MS,
    requestImmediateBeep
  ]);
  
  const reset = useCallback(() => {
    signalBufferRef.current = [];
    processedValuesRef.current = [];
    lastValidBpmRef.current = 0;
    lastSignalQualityRef.current = 0;
    consecutiveWeakSignalsRef.current = 0;
    lastPeakTimeRef.current = null;
    lastConfirmedPeakRef.current = false;
    peakConfirmationBufferRef.current = [];
    lastValueRef.current = 0;
    lastDerivativeRef.current = 0;
    baselineRef.current = 0;
    rmssdHistoryRef.current = [];
    peakIndexHistoryRef.current = [];
    
    cleanupBeepProcessor();
  }, [cleanupBeepProcessor]);
  
  return {
    processSignal,
    reset,
    lastValidBpmRef,
    lastPeakTimeRef,
    lastSignalQualityRef,
    consecutiveWeakSignalsRef,
    MAX_CONSECUTIVE_WEAK_SIGNALS
  };
}

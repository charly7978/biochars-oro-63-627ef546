
import { useCallback, useRef } from 'react';
import { HeartBeatResult } from './types';
import ArrhythmiaDetectionService from '@/services/ArrhythmiaDetectionService';
import FingerDetectionService from '@/services/FingerDetectionService';
import { 
  checkWeakSignal, 
  shouldProcessMeasurement, 
  createWeakSignalResult,
  handlePeakDetection,
  updateLastValidBpm,
  processLowConfidenceResult
} from './signal-processing';

export const useSignalProcessor = () => {
  // Reference values
  const lastPeakTimeRef = useRef<number | null>(null);
  const lastValidBpmRef = useRef<number>(0);
  const lastSignalQualityRef = useRef<number>(0);
  const consecutiveWeakSignalsRef = useRef<number>(0);
  
  // Constants
  const MAX_CONSECUTIVE_WEAK_SIGNALS = 15;
  
  /**
   * Process signal and detect heartbeats using a consolidated approach
   * Only processes real data - no simulation
   */
  const processSignal = useCallback((
    value: number, 
    currentBPM: number, 
    confidence: number, 
    processor: any, 
    requestBeep: (value: number) => boolean,
    isMonitoringRef: React.MutableRefObject<boolean>,
    lastRRIntervalsRef: React.MutableRefObject<number[]>,
    currentBeatIsArrhythmiaRef: any
  ): HeartBeatResult => {
    // Validate input
    if (!processor || typeof value !== 'number') {
      return createWeakSignalResult(ArrhythmiaDetectionService.getArrhythmiaCount());
    }
    
    // Check if signal is weak and update counters
    const { isWeakSignal, updatedWeakSignalsCount } = checkWeakSignal(
      value,
      consecutiveWeakSignalsRef.current,
      { lowSignalThreshold: 0.05, maxWeakSignalCount: MAX_CONSECUTIVE_WEAK_SIGNALS }
    );
    
    // Update state
    consecutiveWeakSignalsRef.current = updatedWeakSignalsCount;
    lastSignalQualityRef.current = confidence * 100;
    
    // Check if signal should be processed
    if (isWeakSignal || !shouldProcessMeasurement(value)) {
      return createWeakSignalResult(ArrhythmiaDetectionService.getArrhythmiaCount());
    }
    
    // Process signal with real hardware
    const result = processor.processSignal(value);
    
    // Update FingerDetectionService with processed signal
    FingerDetectionService.updateDetection(
      value, 
      result.confidence * 100, 
      result.isPeak
    );
    
    // Handle peak detection
    if (result.isPeak) {
      handlePeakDetection(result, lastPeakTimeRef, isMonitoringRef);
      
      // Attempt to play beep sound
      requestBeep(value);
    }
    
    // Update last valid BPM
    updateLastValidBpm(result, lastValidBpmRef);
    
    // Process low confidence results
    const processedResult = processLowConfidenceResult(result, currentBPM);
    
    // Add finger detection status
    processedResult.fingerDetected = FingerDetectionService.isFingerDetected();
    
    // Update ArrhythmiaDetectionService with RR intervals if available
    if (result.rrData && result.rrData.intervals && result.rrData.intervals.length > 0) {
      ArrhythmiaDetectionService.updateRRIntervals(result.rrData.intervals);
      
      // Pass intervals to lastRRIntervalsRef for consistent access
      if (lastRRIntervalsRef) {
        lastRRIntervalsRef.current = result.rrData.intervals;
      }
      
      // Detect arrhythmia and update the result
      const arrhythmiaResult = ArrhythmiaDetectionService.detectArrhythmia(result.rrData.intervals);
      processedResult.isArrhythmia = arrhythmiaResult.isArrhythmia;
      
      // Add arrhythmia count to the result
      processedResult.arrhythmiaCount = ArrhythmiaDetectionService.getArrhythmiaCount();
    }
    
    return processedResult;
  }, []);
  
  /**
   * Reset all counters and references
   */
  const reset = useCallback(() => {
    lastPeakTimeRef.current = null;
    lastValidBpmRef.current = 0;
    lastSignalQualityRef.current = 0;
    consecutiveWeakSignalsRef.current = 0;
    console.log("Signal processor reset");
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

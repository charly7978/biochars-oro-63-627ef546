
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
  
  // Simple reference counter for compatibility
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
      return createWeakSignalResult();
    }

    try {
      calibrationCounterRef.current++;
      
      // Check for weak signal - MEJORADO
      const { isWeakSignal, updatedWeakSignalsCount } = checkWeakSignal(
        value, 
        consecutiveWeakSignalsRef.current, 
        {
          lowSignalThreshold: WEAK_SIGNAL_THRESHOLD,
          maxWeakSignalCount: MAX_CONSECUTIVE_WEAK_SIGNALS
        }
      );
      
      consecutiveWeakSignalsRef.current = updatedWeakSignalsCount;
      
      // MODIFICADO: menos restrictivo con señales débiles para mejor experiencia
      if (isWeakSignal && calibrationCounterRef.current > 30) {
        return createWeakSignalResult(processor.getArrhythmiaCounter ? processor.getArrhythmiaCounter() : 0);
      }
      
      // MEJORADO: procesar todas las señales al inicio para calibración
      if (!shouldProcessMeasurement(value) && calibrationCounterRef.current > 30) {
        return createWeakSignalResult(processor.getArrhythmiaCounter ? processor.getArrhythmiaCounter() : 0);
      }
      
      // Process real signal with confidence boost during initial calibration
      let confBoost = calibrationCounterRef.current < 30 ? 0.15 : 0;
      const result = processor.processSignal(value);
      
      if (result) {
        result.confidence += confBoost; // Boost confidence during calibration
      }
      
      const rrData = processor.getRRIntervals ? processor.getRRIntervals() : null;
      
      if (rrData && rrData.intervals && rrData.intervals.length > 0) {
        lastRRIntervalsRef.current = [...rrData.intervals];
      }
      
      // MEJORADO: detección de picos más sensible
      handlePeakDetection(
        result, 
        lastPeakTimeRef,
        requestImmediateBeep,
        isMonitoringRef,
        value
      );
      
      // Update last valid BPM if it's reasonable
      updateLastValidBpm(result, lastValidBpmRef);
      
      lastSignalQualityRef.current = result.confidence || 0;

      // Process result with improvements
      return processLowConfidenceResult(
        result, 
        currentBPM
      );
    } catch (error) {
      console.error('useHeartBeatProcessor: Error processing signal', error);
      return {
        bpm: currentBPM > 0 ? currentBPM : 75, // Fallback to reasonable value
        confidence: 0,
        isPeak: false,
        arrhythmiaCount: processor.getArrhythmiaCounter ? processor.getArrhythmiaCounter() : 0,
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

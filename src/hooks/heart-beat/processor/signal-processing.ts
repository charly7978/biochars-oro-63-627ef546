
import { useCallback } from 'react';
import { HeartBeatResult } from '../types';
import { ProcessorRefs } from './types';

export function useProcessorSignalHandling(
  processorRef: React.MutableRefObject<any | null>,
  currentBPM: number,
  confidence: number,
  requestBeep: (value: number) => boolean,
  processSignalInternal: (
    value: number, 
    currentBPM: number, 
    confidence: number, 
    processor: any, 
    requestBeep: (value: number) => boolean, 
    isMonitoringRef: React.MutableRefObject<boolean>, 
    lastRRIntervalsRef: React.MutableRefObject<number[]>, 
    currentBeatIsArrhythmiaRef: React.MutableRefObject<boolean>
  ) => HeartBeatResult,
  { isMonitoringRef }: ProcessorRefs,
  lastRRIntervalsRef: React.MutableRefObject<number[]>,
  currentBeatIsArrhythmiaRef: React.MutableRefObject<boolean>,
  setCurrentBPM: React.Dispatch<React.SetStateAction<number>>,
  setConfidence: React.Dispatch<React.SetStateAction<number>>,
  detectArrhythmia: (rrIntervals: number[]) => any
) {
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

    const result = processSignalInternal(
      value, 
      currentBPM, 
      confidence, 
      processorRef.current, 
      requestBeep, 
      isMonitoringRef, 
      lastRRIntervalsRef, 
      currentBeatIsArrhythmiaRef
    );

    // Update BPM and confidence states
    if (result.bpm > 0 && result.confidence > 0.4) {
      setCurrentBPM(result.bpm);
      setConfidence(result.confidence);
    }

    // Analyze RR intervals for arrhythmia detection
    if (lastRRIntervalsRef.current.length >= 3) {
      const arrhythmiaResult = detectArrhythmia(lastRRIntervalsRef.current);
      currentBeatIsArrhythmiaRef.current = arrhythmiaResult.isArrhythmia;
      
      // Update result with arrhythmia status
      result.isArrhythmia = currentBeatIsArrhythmiaRef.current;
    }

    return result;
  }, [
    currentBPM, 
    confidence, 
    processSignalInternal, 
    requestBeep, 
    detectArrhythmia,
    processorRef,
    isMonitoringRef,
    lastRRIntervalsRef,
    currentBeatIsArrhythmiaRef,
    setCurrentBPM,
    setConfidence
  ]);

  return processSignal;
}


import { useCallback, useRef } from 'react';
import { HeartBeatResult } from './types';
import { HeartBeatConfig } from '../../modules/heart-beat/config';

export function useSignalProcessor() {
  const lastPeakTimeRef = useRef<number | null>(null);
  const lastValidBpmRef = useRef<number>(0);
  const lastSignalQualityRef = useRef<number>(0);
  const consecutiveWeakSignalsRef = useRef<number>(0);
  const MAX_CONSECUTIVE_WEAK_SIGNALS = HeartBeatConfig.LOW_SIGNAL_FRAMES;

  const reset = useCallback(() => {
    lastPeakTimeRef.current = null;
    lastValidBpmRef.current = 0;
    lastSignalQualityRef.current = 0;
    consecutiveWeakSignalsRef.current = 0;
  }, []);

  return {
    reset,
    lastPeakTimeRef,
    lastValidBpmRef,
    lastSignalQualityRef,
    consecutiveWeakSignalsRef,
    MAX_CONSECUTIVE_WEAK_SIGNALS
  };
}

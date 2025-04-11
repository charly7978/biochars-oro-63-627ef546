
import { HeartBeatResult } from '../types';
import { MutableRefObject } from 'react';

/**
 * Handle peak detection and trigger beep if needed
 */
export function handlePeakDetection(
  result: HeartBeatResult,
  lastPeakTimeRef: MutableRefObject<number | null>,
  requestImmediateBeep: (value: number) => boolean,
  isMonitoringRef: MutableRefObject<boolean>,
  processedValue: number
): void {
  if (result.isPeak) {
    const now = Date.now();
    lastPeakTimeRef.current = now;
    
    if (isMonitoringRef.current) {
      requestImmediateBeep(processedValue);
    }
  }
}

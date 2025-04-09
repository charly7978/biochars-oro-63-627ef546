/**
 * Signal processing utilities for heart rate monitoring
 */

import { HeartBeatResult } from './types';

/**
 * Check if signal is too weak
 */
export function checkWeakSignal(
  value: number, 
  currentWeakSignalCount: number,
  options: { lowSignalThreshold: number, maxWeakSignalCount: number }
): { isWeakSignal: boolean, updatedWeakSignalsCount: number } {
  // Determine if this is a weak signal
  const isCurrentSignalWeak = Math.abs(value) < options.lowSignalThreshold;
  
  // Update consecutive weak signals count
  let updatedWeakSignalsCount = isCurrentSignalWeak 
    ? currentWeakSignalCount + 1 
    : Math.max(0, currentWeakSignalCount - 1);
  
  // Check if we've had too many weak signals in a row
  const isWeakSignal = updatedWeakSignalsCount >= options.maxWeakSignalCount;
  
  return { isWeakSignal, updatedWeakSignalsCount };
}

/**
 * Determine if a measurement should be processed based on signal strength
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Only process measurements with sufficient amplitude
  return Math.abs(value) >= 0.05;
}

/**
 * Create a result object for weak signal conditions
 */
export function createWeakSignalResult(arrhythmiaCount?: number): HeartBeatResult {
  return {
    bpm: 0,
    confidence: 0,
    isPeak: false,
    arrhythmiaCount: arrhythmiaCount || 0,
    rrData: {
      intervals: [],
      lastPeakTime: null
    }
  };
}

/**
 * Handle peak detection and optional beep
 */
export function handlePeakDetection(
  result: any, 
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  requestImmediateBeep: (value: number) => boolean,
  isMonitoringRef: React.MutableRefObject<boolean>,
  value: number
): void {
  if (result.isPeak) {
    const now = Date.now();
    lastPeakTimeRef.current = now;
    
    // Trigger immediate beep with audio volume based on peak amplitude
    if (isMonitoringRef.current) {
      // Scale value to appropriate volume (0.3-0.9)
      const beepVolume = Math.min(0.9, Math.max(0.3, Math.abs(value) * 2));
      requestImmediateBeep(beepVolume);
    }
  }
}

/**
 * Update last valid BPM if it's a reasonable heart rate
 */
export function updateLastValidBpm(
  result: any, 
  lastValidBpmRef: React.MutableRefObject<number>
): void {
  if (result.bpm > 0 && result.confidence > 0.5) {
    // Only update if it's a physiologically plausible heart rate
    if (result.bpm >= 40 && result.bpm <= 200) {
      lastValidBpmRef.current = result.bpm;
    }
  }
}

/**
 * Process potentially low confidence results
 */
export function processLowConfidenceResult(
  result: any, 
  currentBPM: number,
  arrhythmiaCount: number,
  rrData: any
): HeartBeatResult {
  // If confidence is too low, use the last known good BPM
  if (result.confidence < 0.4 && currentBPM > 0) {
    return {
      bpm: currentBPM,
      confidence: result.confidence,
      isPeak: result.isPeak,
      arrhythmiaCount,
      rrData
    };
  }
  
  // Otherwise, use the new result
  return {
    bpm: result.bpm,
    confidence: result.confidence,
    isPeak: result.isPeak,
    arrhythmiaCount,
    rrData
  };
}

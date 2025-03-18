/**
 * Functions for processing signal results
 */

/**
 * Process result data for heart beat analysis
 * Only uses real data, no simulation
 */

import { HeartBeatResult } from '../types';

export const createWeakSignalResult = (arrhythmiaCount: number = 0): HeartBeatResult => {
  return {
    bpm: 0,
    confidence: 0,
    isPeak: false,
    arrhythmiaCount,
    rrData: {
      intervals: [],
      lastPeakTime: null
    }
  };
};

/**
 * Process signal results with low confidence
 */
export const processLowConfidenceResult = (
  result: HeartBeatResult,
  currentBPM: number,
  arrhythmiaCount: number = 0
): HeartBeatResult => {
  // If confidence is too low, maintain the current BPM value
  if (result.confidence < 0.4) {
    return {
      ...result,
      bpm: currentBPM > 0 ? currentBPM : result.bpm,
      arrhythmiaCount
    };
  }
  
  // Otherwise use the real measurement result
  return result;
};

/**
 * Handle peak detection
 */
export const handlePeakDetection = (
  result: HeartBeatResult,
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  requestBeepCallback: (value: number) => boolean,
  isMonitoringRef: React.MutableRefObject<boolean>,
  value: number
): void => {
  const now = Date.now();
  
  // Only process peaks with minimum confidence
  if (result.isPeak && result.confidence > 0.4) {
    lastPeakTimeRef.current = now;
    
    if (isMonitoringRef.current && result.confidence > 0.5) {
      requestBeepCallback(value);
    }
  }
};

export const updateLastValidBpm = (
  result: HeartBeatResult,
  lastValidBpmRef: React.MutableRefObject<number>
): void => {
  // Only update with real measurements, not simulated values
  if (result.confidence > 0.4 && result.bpm >= 40 && result.bpm <= 200) {
    lastValidBpmRef.current = result.bpm;
  }
};

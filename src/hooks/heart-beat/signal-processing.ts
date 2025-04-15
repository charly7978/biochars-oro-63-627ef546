
import { HeartBeatResult } from "./types";

/**
 * Check for weak signal - delegated to FingerDetectionService
 */
export function checkWeakSignal(
  value: number,
  consecutiveWeakSignals: number,
  options: { lowSignalThreshold: number; maxWeakSignalCount: number }
): { isWeakSignal: boolean; updatedWeakSignalsCount: number } {
  const LOW_SIGNAL_THRESHOLD = options.lowSignalThreshold;
  const MAX_WEAK_SIGNALS = options.maxWeakSignalCount;
  
  const isCurrentValueWeak = Math.abs(value) < LOW_SIGNAL_THRESHOLD;
  let updatedWeakSignalsCount = isCurrentValueWeak ? 
    consecutiveWeakSignals + 1 : 0;
  
  updatedWeakSignalsCount = Math.min(updatedWeakSignalsCount, MAX_WEAK_SIGNALS);
  const isWeakSignal = updatedWeakSignalsCount >= MAX_WEAK_SIGNALS;
  
  return { isWeakSignal, updatedWeakSignalsCount };
}

/**
 * Determine if a measurement should be processed based on signal strength
 */
export function shouldProcessMeasurement(value: number): boolean {
  return Math.abs(value) >= 0.05;
}

/**
 * Create a result object for weak signal
 */
export function createWeakSignalResult(arrhythmiaCount: number = 0): HeartBeatResult {
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
}

/**
 * Handle peak detection
 */
export function handlePeakDetection(
  result: { isPeak: boolean },
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  isMonitoringRef: React.MutableRefObject<boolean>
): void {
  if (result.isPeak) {
    const now = Date.now();
    
    if (lastPeakTimeRef.current && isMonitoringRef.current) {
      // Calculate and validate RR interval - handled by ArrhythmiaDetectionService now
    }
    
    lastPeakTimeRef.current = now;
  }
}

/**
 * Update last valid BPM if result is reasonable
 */
export function updateLastValidBpm(
  result: { bpm: number; confidence: number },
  lastValidBpmRef: React.MutableRefObject<number>
): void {
  if (result.bpm > 30 && result.bpm < 220 && result.confidence > 0.5) {
    lastValidBpmRef.current = result.bpm;
  }
}

/**
 * Process a result with low confidence
 */
export function processLowConfidenceResult(
  result: HeartBeatResult,
  currentBPM: number
): HeartBeatResult {
  if (result.confidence < 0.3 && currentBPM > 0) {
    // Return current BPM with low confidence to avoid jumps
    return {
      ...result,
      bpm: currentBPM,
      confidence: 0.1
    };
  }
  return result;
}

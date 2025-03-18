
import { checkWeakSignal, resetSignalQualityState } from './signal-quality';

export { checkWeakSignal, resetSignalQualityState };

/**
 * Create a result object for weak signal situations
 */
export function createWeakSignalResult(arrhythmiaCount: number = 0) {
  return {
    bpm: 0,
    confidence: 0,
    isPeak: false,
    arrhythmiaCount,
    rrData: { intervals: [], lastPeakTime: null }
  };
}

/**
 * Check if measurement has sufficient amplitude for processing
 * Enhanced to require more stable signal
 */
export function shouldProcessMeasurement(value: number): boolean {
  return Math.abs(value) > 0.12; // Increased from lower values to require stronger signal
}

/**
 * Handle peak detection logic
 */
export function handlePeakDetection(
  result: { isPeak: boolean },
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  requestImmediateBeep: (value: number) => boolean,
  isMonitoringRef: React.MutableRefObject<boolean>,
  value: number
): void {
  if (result.isPeak) {
    const now = Date.now();
    
    // Enhanced frequency validation
    const validPeak = lastPeakTimeRef.current === null || 
                      (now - lastPeakTimeRef.current) > 400; // Minimum 150 BPM max
    
    if (validPeak) {
      lastPeakTimeRef.current = now;
      
      if (isMonitoringRef.current) {
        // Only request beeps for strong signals to reduce false positives
        if (Math.abs(value) > 0.15) {
          requestImmediateBeep(value);
        }
      }
    } else {
      // Suppress likely false positive peaks
      result.isPeak = false;
    }
  }
}

/**
 * Update last valid BPM with enhanced validation
 */
export function updateLastValidBpm(
  result: { bpm: number, confidence: number },
  lastValidBpmRef: React.MutableRefObject<number>
): void {
  // Only accept BPM values within physiological range and with good confidence
  if (result.bpm >= 40 && result.bpm <= 180 && result.confidence > 0.6) {
    // Smooth transitions to prevent jumps from false readings
    if (lastValidBpmRef.current === 0) {
      lastValidBpmRef.current = result.bpm;
    } else if (Math.abs(result.bpm - lastValidBpmRef.current) < 20) {
      // Gradual update for small changes
      lastValidBpmRef.current = 0.7 * lastValidBpmRef.current + 0.3 * result.bpm;
    } else if (Math.abs(result.bpm - lastValidBpmRef.current) < 40) {
      // More conservative update for larger changes
      lastValidBpmRef.current = 0.85 * lastValidBpmRef.current + 0.15 * result.bpm;
    }
    // Ignore very large changes as likely false readings
  }
}

/**
 * Process low confidence results with enhanced validation
 */
export function processLowConfidenceResult(
  result: any,
  currentBPM: number,
  arrhythmiaCount: number,
  minConfidenceThreshold: number = 0.6 // Increased threshold for reliability
): any {
  if (result.confidence < minConfidenceThreshold) {
    // Return current BPM for low confidence readings to avoid fluctuations
    return {
      ...result,
      bpm: currentBPM > 0 ? currentBPM : result.bpm,
      confidence: Math.max(result.confidence, 0.1),
      arrhythmiaCount
    };
  }
  
  return { ...result, arrhythmiaCount };
}

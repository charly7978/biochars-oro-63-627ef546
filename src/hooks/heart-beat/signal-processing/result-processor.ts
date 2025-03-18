
/**
 * Functions for processing signal results
 */

/**
 * Process signal results with low confidence
 */
export function processLowConfidenceResult(
  result: any, 
  currentBPM: number,
  arrhythmiaCounter: number = 0
): any {
  // If confidence is very low, don't update values
  if (result.confidence < 0.25) {
    return {
      bpm: currentBPM,
      confidence: result.confidence,
      isPeak: false,
      arrhythmiaCount: arrhythmiaCounter || 0,
      rrData: {
        intervals: [],
        lastPeakTime: null
      }
    };
  }
  
  return result;
}

/**
 * Handle peak detection
 */
export function handlePeakDetection(
  result: any, 
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  requestBeepCallback: (value: number) => boolean,
  isMonitoringRef: React.MutableRefObject<boolean>,
  value: number
): void {
  const now = Date.now();
  
  // Only process peaks with minimum confidence
  if (result.isPeak && result.confidence > 0.4) {
    lastPeakTimeRef.current = now;
    
    if (isMonitoringRef.current && result.confidence > 0.5) {
      requestBeepCallback(value);
    }
  }
}

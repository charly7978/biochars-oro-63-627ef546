
/**
 * Module for processing results from heart rate analysis
 */

/**
 * Update the last valid BPM reference
 * @param result Current result from signal processing
 * @param lastValidBpmRef Reference to last valid BPM
 */
export const updateLastValidBpm = (
  result: any,
  lastValidBpmRef: React.MutableRefObject<number>
): void => {
  // Only update if we have a reasonable value
  if (result.bpm > 0 && result.confidence > 0.3) {
    // Ensure the BPM is in a physiologically reasonable range
    if (result.bpm >= 40 && result.bpm <= 220) {
      lastValidBpmRef.current = result.bpm;
    }
  }
};

/**
 * Process a low confidence result using historical data
 * @param result Current signal processing result
 * @param currentBPM Current BPM value
 * @param arrhythmiaCount Current arrhythmia count
 * @returns Processed result
 */
export const processLowConfidenceResult = (
  result: any,
  currentBPM: number,
  arrhythmiaCount: number = 0
): any => {
  // If result has zero confidence but we have a current BPM,
  // use the current BPM with low confidence
  if (result.confidence < 0.1 && result.bpm === 0 && currentBPM > 0) {
    return {
      bpm: currentBPM,
      confidence: 0.1,
      isPeak: false,
      isArrhythmia: false,
      arrhythmiaCount: arrhythmiaCount,
      rrData: result.rrData || {
        intervals: [],
        lastPeakTime: null
      }
    };
  }
  
  // Ensure arrhythmia count is included even if result doesn't have it
  if (result.arrhythmiaCount === undefined) {
    result.arrhythmiaCount = arrhythmiaCount;
  }
  
  return result;
};

/**
 * Enhance arrhythmia detection with historical context
 * @param isCurrentBeatArrhythmia Is the current beat showing arrhythmia
 * @param lastIsArrhythmia Was the previous beat showing arrhythmia
 * @param rrVariation Current RR variation
 * @returns Whether to report arrhythmia
 */
export const enhanceArrhythmiaDetection = (
  isCurrentBeatArrhythmia: boolean,
  lastIsArrhythmia: boolean,
  rrVariation: number
): boolean => {
  // Require more consistency for reporting arrhythmia
  // Either multiple consecutive beats or very high variation
  if (isCurrentBeatArrhythmia) {
    if (lastIsArrhythmia || rrVariation > 0.3) {
      return true;
    }
  }
  
  return false;
};

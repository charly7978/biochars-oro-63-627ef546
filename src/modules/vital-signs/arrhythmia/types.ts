
/**
 * Types for arrhythmia detection
 */

/**
 * RR interval data for arrhythmia detection
 */
export interface RRIntervalData {
  intervals: number[];
  lastPeakTime: number | null;
}

/**
 * Result of arrhythmia processing
 */
export interface ArrhythmiaProcessingResult {
  arrhythmiaStatus: string;
  lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
}


/**
 * Types for heart beat processing
 */

/**
 * Result from heart beat signal processing
 */
export interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  arrhythmiaCount: number;
  isArrhythmia?: boolean;
  rrData: {
    intervals: number[];
    lastPeakTime: number | null;
  };
}

/**
 * Configuration for beat detector
 */
export interface BeatDetectorConfig {
  sampleRate: number;
  windowSize: number;
  minBPM: number;
  maxBPM: number;
  signalThreshold: number;
  minConfidence: number;
}

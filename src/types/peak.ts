export interface RRIntervalData {
  intervals: number[];
  lastPeakTime: number | null;
}

/**
 * Interface for peak data
 * Used to synchronize audio, visual, and haptic feedback
 */
export interface PeakData {
  timestamp: number;
  value: number;
  isArrhythmia?: boolean;
}


/**
 * Type definitions for heart beat detection
 */

export interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  arrhythmiaCount: number;
  rrData: {
    intervals: number[];
    lastPeakTime: number | null;
  };
  isArrhythmia: boolean;
  transition?: {
    active: boolean;
    progress: number;
    direction: 'none' | 'up' | 'down';
  };
}

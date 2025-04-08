
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

export interface UseHeartBeatReturn {
  currentBPM: number;
  confidence: number;
  processSignal: (value: number) => HeartBeatResult;
  reset: () => void;
  isArrhythmia: boolean;
  requestBeep: (value: number) => boolean;
  startMonitoring: () => void;
  stopMonitoring: () => void;
}

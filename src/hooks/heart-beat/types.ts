
/**
 * Interface for heart beat processing results.
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
  isArrhythmia?: boolean;
  arrhythmiaSegment?: {
    startTime: number;
    endTime: number | null;
  };
}

/**
 * Type for RR interval data structure
 */
export interface RRIntervalData {
  intervals: number[];
  lastPeakTime: number | null;
}

/**
 * Return type for useHeartBeatProcessor hook.
 */
export interface UseHeartBeatReturn {
  currentBPM: number;
  confidence: number;
  processSignal: (value: number) => HeartBeatResult;
  reset: () => void;
  isArrhythmia: boolean;
  requestBeep: (value: number) => boolean;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  arrhythmiaSegments?: Array<{startTime: number, endTime: number | null}>;
}

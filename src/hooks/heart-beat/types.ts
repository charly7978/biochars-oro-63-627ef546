
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
  arrhythmiaSegment?: {
    startTime: number;
    endTime: number | null;
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
  arrhythmiaSegments: Array<{startTime: number, endTime: number | null}>;
}

// Add this interface for any files that may need it
export interface RRIntervalData {
  intervals: number[];
  lastPeakTime: number | null;
}

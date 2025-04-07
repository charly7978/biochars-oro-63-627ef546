
/**
 * Interface for RR interval data
 */
export interface RRIntervalData {
  intervals: number[];
  lastPeakTime: number | null;
}

/**
 * Interface for heart beat result
 */
export interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  arrhythmiaCount?: number;
  filteredValue?: number;
  rrData?: RRIntervalData;
  isArrhythmia?: boolean;
}

/**
 * Interface for heart beat processor hook return
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
  arrhythmiaSegments: Array<{start: number, end: number}>;
}


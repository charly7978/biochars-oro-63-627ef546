
import { RRAnalysisResult } from "../arrhythmia/types";

export interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  isArrhythmia?: boolean;
  arrhythmiaCount: number;
  filteredValue?: number;
  rrData?: {
    intervals: number[];
    lastPeakTime: number | null;
  };
}

export interface UseHeartBeatReturn {
  currentBPM: number;
  confidence: number;
  isArrhythmia?: boolean;
  processSignal: (value: number) => HeartBeatResult;
  reset: () => void;
  requestBeep: (value: number) => boolean;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  heartBeatResult?: HeartBeatResult;
}

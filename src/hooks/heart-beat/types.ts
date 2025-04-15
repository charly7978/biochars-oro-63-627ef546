
import { RRAnalysisResult } from '../arrhythmia/types';

export interface RRIntervalData {
  intervals: number[];
  lastPeakTime: number | null;
}

export interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  filteredValue?: number;
  arrhythmiaCount: number;
  isArrhythmia?: boolean;
  rrData?: RRIntervalData;
  fingerDetected?: boolean;  // Add this property to fix the type error
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
  arrhythmiaCount?: number;
}

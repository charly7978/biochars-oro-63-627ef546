
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

export interface PeakResult {
  value: number;
  quality: number;
  isPeak: boolean;
}

export interface ProcessedSignal {
  value: number;
  filteredValue: number;
  quality: number;
  isPeak: boolean;
  fingerDetected: boolean;
  isWeakSignal: boolean;
  calibration: {
    progress: {
      fingerDetection: number;
      signalQuality: number;
      stability: number;
    };
    isCalibrated: boolean;
    isHighSignalQuality: boolean;
  }
}

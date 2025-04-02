
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
  tensorflowEnhanced?: boolean; // Indicates if TensorFlow was used for processing
  signalQuality?: number; // TensorFlow-calculated signal quality score
  errorMargin?: number; // Error margin for BPM estimation
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

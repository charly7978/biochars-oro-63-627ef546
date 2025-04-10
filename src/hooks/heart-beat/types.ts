
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

export interface PPGDataPoint {
  time: number;
  value: number;
  isPeak: boolean;
  isArrhythmia?: boolean;
}

export interface CardiacMetrics {
  bpm: number;
  confidence: number;
  rrVariability: number;
  rrIntervalAvg?: number;
  rrIntervalMin?: number;
  rrIntervalMax?: number;
  waveformAmplitude?: number;
  qualityScore: number;
  arrhythmiaCount: number;
}

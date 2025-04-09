
/**
 * Heart beat signal processing types
 */

export interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  arrhythmiaCount: number;
  rrData: RRIntervalData;
  isArrhythmia?: boolean;
}

export interface RRIntervalData {
  intervals: number[];
  lastPeakTime: number | null;
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

export interface HeartBeatConfig {
  useWebGPU: boolean;
  useWaveletFiltering: boolean;
  useTensorFlow: boolean;
  arrhythmiaDetection: boolean;
}

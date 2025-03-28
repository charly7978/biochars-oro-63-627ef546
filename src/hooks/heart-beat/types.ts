
import type { CardiacAnalysisResult } from '../../modules/vital-signs/CardiacWaveformAnalyzer';

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
  waveformAnalysis?: CardiacAnalysisResult | null;
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
  waveformAnalysis?: CardiacAnalysisResult | null;
}

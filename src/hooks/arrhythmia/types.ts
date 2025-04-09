
/**
 * Types for advanced arrhythmia detection
 */

export interface RRAnalysisResult {
  isArrhythmia: boolean;
  irregularityScore: number;
  hrv?: {
    rmssd: number;
    sdnn: number;
    pnn50: number;
    lfhfRatio: number;
  };
  waveletEnergy?: number;
}

export interface RRIntervalData {
  intervals: number[];
  lastPeakTime: number | null;
}

export interface ArrhythmiaDetectionConfig {
  minRRIntervals: number;
  adaptiveThreshold: boolean;
  useWaveletAnalysis: boolean;
  detectPrematureBeats: boolean;
}


/**
 * Types for arrhythmia detection and analysis
 */

export interface RRAnalysisResult {
  rmssd: number;
  rrVariation: number;
  timestamp: number;
  isArrhythmia: boolean;
}

export interface ArrhythmiaAnalysisState {
  heartRateVariability: number[];
  stabilityCounter: number;
  lastRRIntervals: number[];
  lastIsArrhythmia: boolean;
  currentBeatIsArrhythmia: boolean;
}

export interface ArrhythmiaDetectionConfig {
  rmssdThreshold?: number;
  rrVariationThreshold?: number;
  stabilityThreshold?: number;
  minRequiredIntervals?: number;
}

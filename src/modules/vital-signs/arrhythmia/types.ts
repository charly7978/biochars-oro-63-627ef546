
/**
 * Types for arrhythmia processing and analysis
 */

export interface RRIntervalData {
  intervals: number[];
  lastPeakTime: number | null;
}

export interface ArrhythmiaProcessingResult {
  arrhythmiaStatus: string;
  lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
}

export interface ArrhythmiaDetectionParams {
  rmssdThreshold: number;
  rrVariationThreshold: number;
  minTimeBetweenArrhythmias: number;
  consecutiveThreshold: number;
  requiredRRIntervals: number;
}

export interface ArrhythmiaPattern {
  type: 'bigeminy' | 'trigeminy' | 'tachycardia' | 'bradycardia' | 'irregular';
  confidence: number;
  matchedRules: string[];
}

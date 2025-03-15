
/**
 * Types for arrhythmia detection and processing
 */

export interface ArrhythmiaResult {
  arrhythmiaStatus: string;
  lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
}

export interface RRData {
  intervals: number[];
  lastPeakTime: number | null;
}

export interface NonLinearMetrics {
  shannonEntropy: number;
  sampleEntropy: number;
  pnnX: number;
}


/**
 * Types for vital signs processing
 */

export interface VitalSignsResult {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd?: number;
    rrVariation?: number;
  } | null;
}

export interface RRIntervalData {
  intervals: number[];
  lastPeakTime: number | null;
}

export interface PPGDataPoint {
  time: number;
  value: number;
  isArrhythmia?: boolean;
}

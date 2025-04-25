
export interface RRIntervalData {
  intervals: number[];
  averageInterval?: number;
  lastPeakTime: number;
}

export interface ArrhythmiaProcessingResult {
  arrhythmiaStatus: string;
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
    category?: string;
  } | null;
}

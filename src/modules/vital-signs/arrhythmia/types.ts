
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
  arrhythmiaWindows?: Array<{start: number, end: number}>;
}


/**
 * Interface for RR interval data
 */
export interface RRIntervalData {
  intervals: number[];
  lastPeakTime: number | null;
}

/**
 * Interface for heart beat result
 */
export interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  arrhythmiaCount?: number;
  filteredValue?: number;
  rrData?: RRIntervalData;
}

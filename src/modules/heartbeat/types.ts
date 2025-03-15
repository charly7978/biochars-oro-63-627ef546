
export interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isBeat: boolean;
  lastBeatTime: number;
  rrData: { timestamp: number; interval: number }[];
}

export interface PotentialPeak {
  time: number;
  value: number;
}

export interface RRIntervalData {
  intervals: number[];
  lastPeakTime: number | null;
}

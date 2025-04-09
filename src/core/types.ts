
export interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  arrhythmiaCount: number;
  rrData?: {
    intervals: number[];
    lastPeakTime: number | null;
  };
  isArrhythmia?: boolean;
  quality?: number;
  filteredValue?: number;
  transition?: {
    active: boolean;
    progress: number;
    direction: string;
  };
}

export interface ProcessedSignal {
  value: number;
  timestamp: number;
  quality: number;
  filteredValue: number;
}

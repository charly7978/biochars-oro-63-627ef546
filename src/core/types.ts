
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
}

export interface ProcessedSignal {
  value: number;
  timestamp: number;
  quality: number;
  filteredValue: number;
}

export interface SignalValidationInfo {
  isValid: boolean;
  validationResult: {
    valid: boolean;
    level: number;
    color: string;
    label: string;
    warnings: string[];
  };
}

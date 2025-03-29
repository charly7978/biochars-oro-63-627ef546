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
  signalLevel: number;
  warnings: string[];
  validationResult: import('./RealSignalValidator').SignalValidationResult;
}

export interface OptimizationResult {
  heartRate: {
    value: number;
    confidence: number;
  };
  optimizedChannels: Map<string, OptimizedChannel>;
  signalQuality: number;
  isDominantFrequencyValid: boolean;
  dominantFrequency: number;
  validationInfo?: SignalValidationInfo;
}

export interface OptimizedChannel {
  values: number[];
  quality: number;
  metadata: {
    dominantFrequency: number;
    periodicityScore: number;
    [key: string]: any;
  };
}

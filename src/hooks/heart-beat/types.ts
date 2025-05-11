
export interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  arrhythmiaCount: number;
  isArrhythmia?: boolean;
  rrData: {
    intervals: number[];
    lastPeakTime: number | null;
  };
}

export interface UseHeartBeatReturn {
  currentBPM: number;
  confidence: number;
  processSignal: (value: number) => HeartBeatResult;
  reset: () => void;
  isArrhythmia: boolean;
  requestBeep: (value: number) => boolean;
  startMonitoring: () => void;
  stopMonitoring: () => void;
}

export interface RRAnalysisResult {
  isArrhythmia: boolean;
  hrv: number;  // Heart Rate Variability
  rmssd: number;  // Root Mean Square of Successive Differences
  rrVariation: number;  // Porcentaje de variación RR
  confidence: number;  // Confianza en la detección
}

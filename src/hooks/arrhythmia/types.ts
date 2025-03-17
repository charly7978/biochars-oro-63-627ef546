
export interface ArrhythmiaConfig {
  MIN_TIME_BETWEEN_ARRHYTHMIAS: number;
  MAX_ARRHYTHMIAS_PER_SESSION: number;
  SIGNAL_QUALITY_THRESHOLD: number;
  SEQUENTIAL_DETECTION_THRESHOLD: number;
  SPECTRAL_FREQUENCY_THRESHOLD: number;
}

export interface RRData {
  intervals: number[];
  lastPeakTime: number | null;
}

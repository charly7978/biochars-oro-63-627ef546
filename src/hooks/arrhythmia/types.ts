
/**
 * Advanced configuration for state-of-the-art arrhythmia detection
 */
export interface ArrhythmiaConfig {
  MIN_TIME_BETWEEN_ARRHYTHMIAS: number;
  MAX_ARRHYTHMIAS_PER_SESSION: number;
  SIGNAL_QUALITY_THRESHOLD: number;
  SEQUENTIAL_DETECTION_THRESHOLD?: number;
  SPECTRAL_FREQUENCY_THRESHOLD?: number;
}

export interface ArrhythmiaPattern {
  score: number;
  confidence: number;
  timestamp: number;
}

export interface RRAnalysisResult {
  rmssd: number;
  rrVariation: number;
  timestamp: number;
  isArrhythmia: boolean;
}

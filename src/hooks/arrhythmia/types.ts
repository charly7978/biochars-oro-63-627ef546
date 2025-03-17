
/**
 * Advanced configuration for signal processing
 */
export interface ProcessingConfig {
  SIGNAL_QUALITY_THRESHOLD: number;
}

export interface RRAnalysisResult {
  rmssd: number;
  rrVariation: number;
  timestamp: number;
  heartRate?: number;
  signalQuality?: number;
}

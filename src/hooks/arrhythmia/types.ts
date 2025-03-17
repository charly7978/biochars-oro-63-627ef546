
/**
 * Basic configuration for heart rate monitoring
 */
export interface HeartRateConfig {
  MIN_TIME_BETWEEN_BEATS: number;
  MAX_BEATS_PER_SESSION: number;
}

export interface RRAnalysisResult {
  rrVariation: number;
  timestamp: number;
  heartRate?: number;
}

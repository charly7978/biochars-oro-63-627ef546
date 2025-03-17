
/**
 * Basic types for signal processing
 */
export interface RRAnalysisResult {
  rmssd: number;
  rrVariation: number;
  timestamp: number;
  heartRate?: number;
  signalQuality?: number;
  isArrhythmia?: boolean;
}

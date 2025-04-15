
export interface RRAnalysisResult {
  isArrhythmia: boolean;
  confidence: number;
  hrvFeatures?: {
    sdnn?: number;
    rmssd?: number;
    pnn50?: number;
  };
}

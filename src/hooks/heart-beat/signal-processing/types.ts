
export interface FeedbackState {
  signalQuality: {
    signalStrength: number;
    noiseLevel: number;
    stabilityScore: number;
    fingerDetectionConfidence: number;
  };
  heartRate: {
    currentBPM: number;
    confidence: number;
    peakStrength: number;
    rhythmStability: number;
    isPeak: boolean;
  };
  vitalSigns: {
    spo2Quality: number;
    pressureReliability: number;
    arrhythmiaConfidence: number;
    glucoseReliability?: number;
    lipidsReliability?: number;
  };
}

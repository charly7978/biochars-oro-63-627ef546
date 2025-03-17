
// Signal quality types and interfaces
export interface SignalQualityState {
  qualityHistory: number[];
  consecutiveFingerFrames: number;
  signalAmplitudeHistory: number[];
  fingerprintConfidence: number;
  detectionStabilityCounter: number;
  lastDetectionState: boolean;
  noiseBuffer: number[];
  peakVariance: number[];
  lastStableDetectionTime: number;
  derivativeBuffer: number[];
}

export interface SignalQualityResult {
  isFingerDetected: boolean;
  quality: number;
  qualityColor: string;
  qualityText: string;
}

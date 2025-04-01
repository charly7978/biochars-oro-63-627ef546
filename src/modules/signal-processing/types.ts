
export interface ProcessedHeartbeatSignal {
  filteredValue: number;
  isPeak: boolean;
  confidence: number;
  bpm: number;
  arrhythmiaCount?: number;
}

export interface SignalProcessingOptions {
  peakThreshold?: number;
  adaptationRate?: number;
  minPeakDistance?: number;
  signalAmplification?: number; // Added to support dynamic amplification
}

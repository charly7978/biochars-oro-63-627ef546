
import { RRAnalysisResult } from '../arrhythmia/types';

export interface RRIntervalData {
  intervals: number[];
  lastPeakTime: number | null;
}

export interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  filteredValue?: number;
  arrhythmiaCount: number;
  isArrhythmia?: boolean;
  rrData?: RRIntervalData;
  tensorflowEnhanced?: boolean; // Indicates if TensorFlow was used for processing
  signalQuality?: number; // TensorFlow-calculated signal quality score
  errorMargin?: number; // Error margin for BPM estimation
  frequencyDomain?: {
    lfHfRatio?: number;   // Low-frequency to high-frequency ratio (stress indicator)
    peakFrequency?: number; // Dominant frequency in the signal
    harmonics?: number[];  // Harmonic frequencies detected
  };
  artifacts?: {
    motionArtifactDetected?: boolean;
    baselineDrift?: number;
    signalToNoiseRatio?: number;
  };
  prediction?: {
    accuracyScore?: number;
    nextBeatPrediction?: number;  // Predicted time of the next heartbeat
    anomalyScore?: number;        // How anomalous the current pattern is
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
  artifacts?: {
    motionArtifactDetected: boolean;
    signalToNoiseRatio: number;
  };
  hrv?: {
    sdnn?: number;  // Standard deviation of NN intervals
    rmssd?: number; // Root mean square of successive differences
    pnn50?: number; // Proportion of NN50 divided by total number of NNs
    lfHfRatio?: number; // Low frequency to high frequency ratio
  };
  stressIndex?: number; // Estimated stress index based on HRV parameters
}

// Advanced types for TensorFlow integration
export interface TensorFlowProcessingConfig {
  modelType: 'filter' | 'predictor' | 'hrv' | 'arrhythmia';
  useWebGL: boolean;
  modelPath?: string;
  inputSize: number;
  outputSize: number;
  samplingRate: number;
  normalizeInput: boolean;
  confidenceThreshold: number;
  enableQuantization?: boolean;
}

export interface SignalProcessingResult {
  processedValue: number;
  peaks: number[];
  quality: number;
  artifacts?: {
    motionArtifactProbability: number;
    baselineDrift: number;
    signalToNoiseRatio: number;
  };
  frequencyAnalysis?: {
    dominantFrequency: number;
    powerSpectrum: number[];
    lfPower: number;  // Low frequency power (0.04-0.15 Hz)
    hfPower: number;  // High frequency power (0.15-0.4 Hz)
    lfHfRatio: number; // LF/HF ratio for stress assessment
  };
}

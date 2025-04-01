
/**
 * Signal types for the application
 */

// Basic signal point with timestamp
export interface SignalPoint {
  value: number;
  timestamp: number;
}

// Region of interest in an image
export interface ROI {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Processed signal with quality metrics
export interface ProcessedSignal {
  timestamp: number;
  rawValue: number;
  filteredValue: number;
  quality: number;
  fingerDetected: boolean;
  roi: ROI;
  perfusionIndex?: number;
  spectrumData?: {
    frequencies: number[];
    amplitudes: number[];
    dominantFrequency: number;
  };
  diagnosticInfo?: {
    processingStage: string;
    validationPassed: boolean;
    errorCode?: string;
    errorMessage?: string;
    processingTimeMs?: number;
    timestamp?: number;
  };
}

// Error in signal processing
export interface ProcessingError {
  code: string;
  message: string;
  timestamp: number;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  recoverable?: boolean;
  component?: string;
  suggestions?: string[];
}

// Interface for signal processor
export interface SignalProcessor {
  processFrame(imageData: ImageData): void;
  start(): void;
  stop(): void;
  resetToDefault(): void;
  initialize(): Promise<void>;
}

// Types of vital signs that can be processed
export enum VitalSignType {
  HEART_RATE = 'heartRate',
  SPO2 = 'spo2',
  BLOOD_PRESSURE = 'bloodPressure',
  GLUCOSE = 'glucose',
  LIPIDS = 'lipids',
  ARRHYTHMIA = 'arrhythmia',
  CARDIAC = 'cardiac'
}

// Feedback from a channel to improve processing
export interface ChannelFeedback {
  channelId: string;
  signalQuality: number;
  suggestedAdjustments: Record<string, number>;
  timestamp: number;
  success: boolean;
}

// Additional interfaces needed by various modules
export interface PPGDataPoint {
  value: number;
  timestamp: number;
  quality?: number;
}

export interface TimestampedPPGData {
  values: number[];
  timestamp: number;
  quality?: number;
}

export interface SignalDiagnosticInfo {
  processingStage: string;
  validationPassed: boolean;
  errorCode?: string;
  errorMessage?: string;
  processingTimeMs?: number;
  timestamp?: number;
}

export interface SignalValidationResult {
  isValid: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export interface SignalValidationConfig {
  qualityThreshold: number;
  validateAmplitude: boolean;
  minAmplitude: number;
  maxAmplitude: number;
  validateFrequency: boolean;
  minFrequency: number;
  maxFrequency: number;
}

export interface ErrorHandlerConfig {
  logErrors: boolean;
  throwOnCritical: boolean;
  recoveryAttempts: number;
  debugMode: boolean;
}

export interface SignalDistributorConfig {
  channelCount: number;
  bufferSize: number;
  processingInterval: number;
  autoStart: boolean;
}

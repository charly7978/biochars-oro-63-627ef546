
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

// PPG Data point
export interface PPGDataPoint {
  red: number;
  ir?: number;
  green?: number;
  blue?: number;
  timestamp: number;
}

// Timestamped PPG Data
export interface TimestampedPPGData {
  data: PPGDataPoint[];
  startTime: number;
  endTime: number;
  samplingRate: number;
}

// Signal validation result
export interface SignalValidationResult {
  isValid: boolean;
  quality: number;
  issues: string[];
  timestamp: number;
}

// Signal validation configuration
export interface SignalValidationConfig {
  minAmplitude: number;
  maxVariance: number;
  minFrequency: number;
  maxFrequency: number;
}

// Signal diagnostic info
export interface SignalDiagnosticInfo {
  timestamp: number;
  processingStage: string;
  executionTime: number;
  signalQuality: number;
  processingPriority: string;
  inputValues: number[];
  outputValues: number[];
  processorType: string;
  warnings: string[];
  signalProperties?: {
    mean: number;
    variance: number;
    peakCount: number;
    dominantFrequency: number;
  };
}

// Error handler configuration
export interface ErrorHandlerConfig {
  logErrors: boolean;
  throwOnCritical: boolean;
  maxRetries: number;
  fallbackEnabled: boolean;
}

// Channel feedback for signal optimization
export interface ChannelFeedback {
  channelId: string;
  signalQuality: number;
  suggestedAdjustments: {
    amplificationFactor?: number;
    filterStrength?: number;
    frequencyRangeMin?: number;
    frequencyRangeMax?: number;
    [key: string]: any;
  };
  timestamp: number;
  success: boolean;
}

// Signal distributor configuration
export interface SignalDistributorConfig {
  channelCount: number;
  optimizationInterval: number;
  adaptiveFiltering: boolean;
  signalBufferSize: number;
}

// Vital sign types
export enum VitalSignType {
  SPO2 = 'spo2',
  BLOOD_PRESSURE = 'bloodPressure',
  GLUCOSE = 'glucose',
  LIPIDS = 'lipids',
  CARDIAC = 'cardiac'
}

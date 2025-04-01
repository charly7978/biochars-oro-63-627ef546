
/**
 * Interface for PPG data point with timestamp
 */
export interface PPGDataPoint {
  timestamp: number;
  value: number;
  time: number; // Required for backward compatibility
  [key: string]: any;
}

/**
 * Interface for standardized PPG data across the system
 */
export interface TimestampedPPGData {
  timestamp: number;
  value: number;
  time: number; // Changed from optional to required to match PPGDataPoint
  [key: string]: any;
}

/**
 * Represents a processed PPG signal
 */
export interface ProcessedSignal {
  timestamp: number;        // Timestamp of the signal
  rawValue: number;         // Raw sensor value
  filteredValue: number;    // Filtered value for analysis
  quality: number;          // Signal quality (0-100)
  fingerDetected: boolean;  // Whether a finger is detected on the sensor
  roi: {                    // Region of interest in the image
    x: number;
    y: number;
    width: number;
    height: number;
  };
  perfusionIndex?: number;  // Optional perfusion index
  spectrumData?: {          // Optional frequency spectrum data
    frequencies: number[];
    amplitudes: number[];
    dominantFrequency: number;
  };
  // New diagnostic info field for error tracking
  diagnosticInfo?: SignalDiagnosticInfo;
}

/**
 * Diagnostic information for signal processing
 * Added for better error tracking and debugging
 */
export interface SignalDiagnosticInfo {
  processingStage: string;              // Where in the pipeline processing occurred
  validationPassed: boolean;            // Whether signal passed validation
  errorCode?: string;                   // Optional error code if validation failed
  errorMessage?: string;                // Optional error message
  processingTimeMs?: number;            // Time taken to process
  signalQualityMetrics?: {              // Detailed quality metrics
    amplitude?: number;
    variance?: number;
    snr?: number;                      // Signal-to-noise ratio if available
  };
  fingerDetectionConfidence?: number;   // Confidence level in finger detection
  timestamp?: number;                   // Added timestamp field for diagnostics (now optional but exists)
}

/**
 * Processing error structure - Enhanced with more details
 */
export interface ProcessingError {
  code: string;                  // Error code
  message: string;               // Descriptive message
  timestamp: number;             // Error timestamp
  component?: string;            // Component where error occurred
  severity: 'low' | 'medium' | 'high' | 'critical';  // Error severity
  recoverable: boolean;          // Whether system can recover from this error
  suggestions?: string[];        // Suggested remediation steps
}

/**
 * Result of signal validation
 */
export interface SignalValidationResult {
  isValid: boolean;
  errorCode?: string;
  errorMessage?: string;
  diagnosticInfo?: Record<string, any>;
}

/**
 * Interface that all signal processors must implement
 */
export interface SignalProcessor {
  initialize: () => Promise<void>;                      // Initialization
  start: () => void;                                    // Start processing
  stop: () => void;                                     // Stop processing
  calibrate?: () => Promise<boolean>;                   // Optional calibration
  onSignalReady?: (signal: ProcessedSignal) => void;    // Signal ready callback
  onError?: (error: ProcessingError) => void;           // Error callback
  processFrame?: (imageData: ImageData) => void;        // Process image frame
  // New methods for error handling
  validateSignal?: (signal: any) => SignalValidationResult;  // Validate incoming signal
  getDiagnosticInfo?: () => SignalDiagnosticInfo;            // Get diagnostic information
}

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  logErrors: boolean;
  retryOnError: boolean;
  maxRetries: number;
  notifyUser: boolean;
  fallbackToLastGoodValue: boolean;
}

/**
 * Signal validation configuration
 */
export interface SignalValidationConfig {
  minAmplitude: number;
  maxAmplitude: number;
  minVariance: number;
  maxVariance: number;
  requiredSampleSize: number;
}

/**
 * Interface for OptimizedSignalChannel
 * Specialized signal channels for different vital signs
 */
export interface OptimizedSignalChannel {
  readonly id: string;                  // Unique identifier
  readonly type: VitalSignType;         // Type of vital sign
  processValue: (value: number) => number;  // Process value for this specific channel
  applyFeedback: (feedback: ChannelFeedback) => void;  // Apply feedback from algorithm
  getQuality: () => number;             // Get channel quality (0-1)
  reset: () => void;                    // Reset channel state
  getId: () => string;                  // Get channel ID
}

/**
 * Types of vital sign measurements
 */
export enum VitalSignType {
  GLUCOSE = 'glucose',
  LIPIDS = 'lipids',
  BLOOD_PRESSURE = 'blood_pressure',
  SPO2 = 'spo2',
  CARDIAC = 'cardiac'
}

/**
 * Feedback from vital sign algorithms to adjust signal processing
 */
export interface ChannelFeedback {
  channelId: string;              // Channel ID
  signalQuality: number;          // Estimated signal quality (0-1)
  suggestedAdjustments: {
    amplificationFactor?: number; // Suggested amplification
    filterStrength?: number;      // Suggested filter strength
    baselineCorrection?: number;  // Baseline correction
    frequencyRangeMin?: number;   // Frequency range minimum
    frequencyRangeMax?: number;   // Frequency range maximum
  };
  timestamp: number;              // Feedback timestamp
  success: boolean;               // Whether last processing was successful
}

/**
 * Configuration for signal distributor
 */
export interface SignalDistributorConfig {
  enableFeedback: boolean;        // Enable bidirectional feedback
  adaptChannels: boolean;         // Allow channels to adapt based on feedback
  optimizationInterval: number;   // Interval for optimization (ms)
  channels: {                     // Channel-specific configurations
    [key in VitalSignType]?: {
      initialAmplification: number;
      initialFilterStrength: number;
      frequencyBandMin: number;
      frequencyBandMax: number;
    }
  };
}

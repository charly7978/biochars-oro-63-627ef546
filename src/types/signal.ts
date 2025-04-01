
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
  time: number; // Required to match PPGDataPoint
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
  fingerDetected: boolean;  // Whether a finger is detected over sensor
  roi: {                    // Region of interest in the image
    x: number;
    y: number;
    width: number;
    height: number;
  };
  perfusionIndex?: number;  // Perfusion index (optional)
  spectrumData?: {          // Spectrum data for frequency analysis
    frequencies: number[];
    amplitudes: number[];
    dominantFrequency: number;
  };
  isPeak?: boolean;         // Whether this signal represents a peak
  peakConfidence?: number;  // Confidence in peak detection (0-1)
  arrhythmiaCount?: number; // Count of detected arrhythmias
  heartRateVariability?: number; // Heart rate variability measurement
}

/**
 * Processing error structure
 */
export interface ProcessingError {
  code: string;       // Error code
  message: string;    // Descriptive message
  timestamp: number;  // Error timestamp
}

/**
 * Interface that all signal processors must implement
 */
export interface SignalProcessor {
  initialize: () => Promise<void>;                      // Initialization
  start: () => void;                                    // Start processing
  stop: () => void;                                     // Stop processing
  calibrate: () => Promise<boolean>;                    // Calibrate processor
  onSignalReady?: (signal: ProcessedSignal) => void;    // Signal ready callback
  onError?: (error: ProcessingError) => void;           // Error callback
  processFrame?: (imageData: ImageData) => void;        // Process frame
}

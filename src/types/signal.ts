
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
}

/**
 * Processing error structure
 */
export interface ProcessingError {
  code: string;       // Error code
  message: string;    // Descriptive message
  timestamp: number;  // Error timestamp
}

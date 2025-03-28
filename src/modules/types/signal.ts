
/**
 * Core signal types for the entire application 
 * These interfaces are used for communication between modules
 */

/**
 * Raw camera frame data after initial extraction
 */
export interface RawSignalFrame {
  timestamp: number;
  redChannel: number;
  greenChannel: number;
  blueChannel: number;
  frameQuality: number;
}

/**
 * Processed PPG signal data
 */
export interface PPGSignal {
  timestamp: number;
  rawValue: number;
  filteredValue: number;
  quality: number;
  fingerDetected: boolean;
  amplified: boolean;
  roi?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  perfusionIndex?: number;
}

/**
 * Heart beat detection result
 */
export interface HeartBeatResult {
  timestamp: number;
  bpm: number;
  confidence: number;
  isPeak: boolean;
  filteredValue: number;
  rrIntervals: number[];
  lastPeakTime: number | null;
}

/**
 * Final vital signs measurement results
 */
export interface VitalSignsResult {
  timestamp: number;
  heartRate: number;
  spo2: number;
  pressure: string;
  glucose?: number;
  lipids?: {
    totalCholesterol: number;
    triglycerides: number;
  };
  arrhythmiaStatus: string;
  reliability: number;
  arrhythmiaData?: {
    rmssd: number;
    windows: {start: number; end: number}[];
    detected: boolean;
  };
}

/**
 * Processing error structure
 */
export interface ProcessingError {
  code: string;
  message: string;
  timestamp: number;
  source: string;
}

/**
 * Camera configuration options
 */
export interface CameraConfig {
  facingMode: string;
  width: number;
  height: number;
  frameRate: number;
  torch: boolean;
}

/**
 * Signal processing options
 */
export interface SignalProcessingOptions {
  filterStrength: number;
  adaptivityLevel: number;
  detectionSensitivity: number;
  fingerprintThreshold: number;
}


/**
 * Centralized configuration for vital signs processing
 * This file serves as the single source of truth for all configuration parameters
 * used across the vital signs processing modules.
 */

// Signal processing configuration
export const SignalProcessingConfig = {
  // Filter parameters
  FILTER: {
    SMA_WINDOW_SIZE: 5,
    MEDIAN_WINDOW_SIZE: 7,
    KALMAN_PROCESS_NOISE: 0.01,
    KALMAN_MEASUREMENT_NOISE: 0.1,
    LOW_PASS_ALPHA: 0.2,
  },
  
  // Signal quality thresholds
  QUALITY: {
    MIN_AMPLITUDE: 0.05,
    MAX_AMPLITUDE: 10,
    MIN_SIGNAL_QUALITY: 0.3,
    CONSECUTIVE_WEAK_SIGNALS_THRESHOLD: 10,
    LOW_SIGNAL_THRESHOLD: 0.10,
  },
  
  // Peak detection parameters
  PEAK: {
    MIN_PEAK_DISTANCE: 300, // milliseconds
    MIN_PEAK_HEIGHT: 0.15,
    MAX_PEAK_HEIGHT: 5,
    ADAPTIVE_THRESHOLD_FACTOR: 0.6,
  }
};

// Arrhythmia detection configuration
export const ArrhythmiaConfig = {
  // Thresholds for arrhythmia detection
  THRESHOLDS: {
    RMSSD: 35, // Root Mean Square of Successive Differences threshold
    RR_VARIATION: 0.17, // RR interval variation threshold
    MIN_VARIATION_PERCENT: 70, // Minimum percentage variation for premature beat
  },
  
  // Timing parameters
  TIMING: {
    MIN_TIME_BETWEEN_ARRHYTHMIAS: 3000, // ms
    MIN_ARRHYTHMIA_INTERVAL_MS: 20000, // ms
    FALSE_POSITIVE_GUARD_PERIOD: 1200, // ms
  },
  
  // Data requirements
  DATA: {
    MIN_RR_INTERVALS: 20, // Minimum number of RR intervals for detection
    REQUIRED_RR_INTERVALS: 5, // Minimum required for basic calculation
    MIN_INTERVAL_MS: 600, // Physiological minimum for RR interval
    MAX_INTERVAL_MS: 1200, // Physiological maximum for RR interval
    CONSECUTIVE_THRESHOLD: 15, // Required consecutive abnormal beats
  },
  
  // Pattern detection
  PATTERN: {
    PATTERN_BUFFER_SIZE: 20,
    ANOMALY_HISTORY_SIZE: 30,
    MIN_ANOMALY_PATTERN_LENGTH: 5,
    PATTERN_MATCH_THRESHOLD: 0.75,
    SIGNAL_DECLINE_THRESHOLD: 0.3,
  }
};

// Blood pressure configuration
export const BloodPressureConfig = {
  // Calculation parameters
  CALCULATION: {
    MIN_SYSTOLIC: 90,
    MAX_SYSTOLIC: 180,
    MIN_DIASTOLIC: 60,
    MAX_DIASTOLIC: 120,
    CALIBRATION_FACTOR: 0.85,
  },
  
  // Required data points
  DATA: {
    MIN_DATA_POINTS: 90,
    CONFIDENCE_THRESHOLD: 0.6,
  }
};

// SpO2 configuration
export const SpO2Config = {
  // Calculation parameters
  CALCULATION: {
    MIN_SPO2: 80,
    MAX_SPO2: 100,
    DEFAULT_SPO2: 98,
    CALIBRATION_FACTOR: 1.02,
  },
  
  // Required data points
  DATA: {
    MIN_DATA_POINTS: 45,
    CONFIDENCE_THRESHOLD: 0.7,
  }
};

// User profile defaults
export const UserProfileDefaults = {
  AGE: 30,
  WEIGHT_KG: 70,
  HEIGHT_CM: 170,
  GENDER: 'neutral',
  CONDITION: 'normal',
};

// Finger detection configuration
export const FingerDetectionConfig = {
  PERFUSION_INDEX_THRESHOLD: 0.045,
  PEAK_THRESHOLD: 0.30,
  LOW_SIGNAL_THRESHOLD: 0.20,
  MAX_WEAK_SIGNALS: 6,
  HISTORY_SIZE: 15, 
  STABILITY_THRESHOLD: 0.15,
  MIN_PHYSIOLOGICAL_SIGNALS: 20,
};

// Feedback configuration
export const FeedbackConfig = {
  HEARTBEAT_NORMAL: {
    VIBRATION_PATTERN: 50, // ms
    AUDIO_FREQUENCY: 880, // Hz
    AUDIO_TYPE: 'square',
    AUDIO_GAIN: 0.05,
    AUDIO_DURATION: 0.1, // seconds
  },
  HEARTBEAT_ARRHYTHMIA: {
    VIBRATION_PATTERN: [50, 100, 100], // ms
    AUDIO_FREQUENCY: 440, // Hz
    AUDIO_TYPE: 'triangle',
    AUDIO_GAIN: 0.08,
    AUDIO_DURATION: 0.2, // seconds
  },
};

/**
 * Centralized configuration interface for all vital signs parameters
 * Allows access to all configuration areas in one place
 */
export const VitalSignsConfig = {
  signal: SignalProcessingConfig,
  arrhythmia: ArrhythmiaConfig,
  bloodPressure: BloodPressureConfig,
  spo2: SpO2Config,
  userProfile: UserProfileDefaults,
  fingerDetection: FingerDetectionConfig,
  feedback: FeedbackConfig,
};

export default VitalSignsConfig;

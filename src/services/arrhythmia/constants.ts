
/**
 * Constants for arrhythmia detection
 */

// Default threshold values
export const DEFAULT_THRESHOLDS = {
  RMSSD_THRESHOLD: 85, // Base threshold for RMSSD
  MIN_INTERVAL: 300, // Minimum physiologically valid RR interval in ms
  MAX_INTERVAL: 2000, // Maximum physiologically valid RR interval in ms
  MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL: 12000, // Minimum time between notifications
  RR_VARIATION_THRESHOLD: 0.20, // Threshold for RR variation ratio
  REQUIRED_CONFIRMATIONS: 4, // Required consecutive detections before confirming
  CONFIRMATION_WINDOW_MS: 14000, // Time window for confirmation
};

// Adjustment factors for different profiles
export const PROFILE_ADJUSTMENTS = {
  AGE_THRESHOLD: 60, // Age above which to apply special adjustments
  AGE_FACTOR: 0.82, // Adjustment factor for elderly
  ATHLETE_FACTOR: 1.3, // Notification interval factor for athletes
  MEDICAL_CONDITION_FACTOR: 0.85, // Threshold factor for medical conditions
};

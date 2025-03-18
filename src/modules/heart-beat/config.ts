
/**
 * Configuration settings for HeartBeatProcessor
 */
export const HeartBeatConfig = {
  // Signal processing settings
  SAMPLE_RATE: 30,
  WINDOW_SIZE: 60,
  MIN_BPM: 40,
  MAX_BPM: 200,
  SIGNAL_THRESHOLD: 0.40, // Reduced from 0.60 for better sensitivity
  MIN_CONFIDENCE: 0.40, // Reduced from 0.50 for better peak detection
  DERIVATIVE_THRESHOLD: -0.02, // Adjusted from -0.03 for better sensitivity
  MIN_PEAK_TIME_MS: 300,
  WARMUP_TIME_MS: 2000,

  // Filter settings
  MEDIAN_FILTER_WINDOW: 3,
  MOVING_AVERAGE_WINDOW: 4, // Reduced from 5 for sharper peaks
  EMA_ALPHA: 0.4, // Increased from 0.3 for more responsive filtering
  BASELINE_FACTOR: 0.990, // Adjusted from 0.995 for better baseline adaptation

  // Audio settings
  BEEP_PRIMARY_FREQUENCY: 880,
  BEEP_SECONDARY_FREQUENCY: 440,
  BEEP_DURATION: 80,
  BEEP_VOLUME: 0.8,
  MIN_BEEP_INTERVAL_MS: 250,

  // Signal quality settings
  LOW_SIGNAL_THRESHOLD: 0.03, // Reduced from 0.05 for better sensitivity
  LOW_SIGNAL_FRAMES: 10
};

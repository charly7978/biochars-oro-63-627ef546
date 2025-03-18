
/**
 * Configuration settings for HeartBeatProcessor
 */
export const HeartBeatConfig = {
  // Signal processing settings
  SAMPLE_RATE: 30,
  WINDOW_SIZE: 60,
  MIN_BPM: 40,
  MAX_BPM: 200,
  SIGNAL_THRESHOLD: 0.70, // Increased from 0.60 for more reliable peak detection
  MIN_CONFIDENCE: 0.65, // Increased from 0.50 to reduce false positives
  DERIVATIVE_THRESHOLD: -0.04, // Adjusted from -0.03 for more precise peak detection
  MIN_PEAK_TIME_MS: 450, // Increased from 300 for more realistic heart rate limits
  WARMUP_TIME_MS: 3000, // Increased from 2000 to allow for better initial stabilization

  // Filter settings
  MEDIAN_FILTER_WINDOW: 5, // Increased from 3 for better noise suppression
  MOVING_AVERAGE_WINDOW: 7, // Increased from 5 for smoother signal
  EMA_ALPHA: 0.25, // Decreased from 0.3 for more stable signal
  BASELINE_FACTOR: 0.997, // Increased from 0.995 for better baseline tracking

  // Audio settings
  BEEP_PRIMARY_FREQUENCY: 880,
  BEEP_SECONDARY_FREQUENCY: 440,
  BEEP_DURATION: 80,
  BEEP_VOLUME: 0.8,
  MIN_BEEP_INTERVAL_MS: 450, // Increased from 250ms to prevent too frequent beeps

  // Signal quality settings
  LOW_SIGNAL_THRESHOLD: 0.08, // Increased from 0.05 for more stable finger detection
  LOW_SIGNAL_FRAMES: 15 // Increased from 10 to reduce false positives
};

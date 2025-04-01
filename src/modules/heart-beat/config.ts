
/**
 * Configuration settings for HeartBeatProcessor
 * Enhanced to ensure one real heartbeat = one peak = one beep
 */
export const HeartBeatConfig = {
  // Signal processing settings
  SAMPLE_RATE: 30,
  WINDOW_SIZE: 60,
  MIN_BPM: 40,
  MAX_BPM: 180, // Lowered from 200 to prevent unrealistically high rates
  SIGNAL_THRESHOLD: 0.66, // Increased from 0.60 for stronger peaks
  MIN_CONFIDENCE: 0.60, // Increased from 0.50 for higher confidence
  DERIVATIVE_THRESHOLD: -0.035, // Stricter derivative threshold
  MIN_PEAK_TIME_MS: 600, // Increased from 300 to enforce maximum ~100 BPM
  WARMUP_TIME_MS: 3000, // Increased from 2000 for more stable initial readings

  // Filter settings
  MEDIAN_FILTER_WINDOW: 5, // Increased from 3 for better noise reduction
  MOVING_AVERAGE_WINDOW: 7, // Increased from 5 for smoother signals
  EMA_ALPHA: 0.25, // Reduced from 0.3 for smoother response
  BASELINE_FACTOR: 0.992, // Increased from 0.995 for more stable baseline

  // Audio settings
  BEEP_PRIMARY_FREQUENCY: 880,
  BEEP_SECONDARY_FREQUENCY: 440,
  BEEP_DURATION: 80,
  BEEP_VOLUME: 0.8,
  MIN_BEEP_INTERVAL_MS: 600, // Increased from 250 to prevent rapid beeping

  // Signal quality settings
  LOW_SIGNAL_THRESHOLD: 0.08, // Increased from 0.05
  LOW_SIGNAL_FRAMES: 12 // Increased from 10
};

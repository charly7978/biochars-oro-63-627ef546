
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
  SIGNAL_THRESHOLD: 0.58, // Reduced from 0.66 to detect more valid heartbeats
  MIN_CONFIDENCE: 0.50, // Reduced from 0.60 to allow more valid peaks 
  DERIVATIVE_THRESHOLD: -0.03, // Less strict derivative threshold
  MIN_PEAK_TIME_MS: 500, // Reduced from 600 to allow higher max heart rate (~120 BPM)
  WARMUP_TIME_MS: 2000, // Reduced from 3000 for faster initial feedback

  // Filter settings
  MEDIAN_FILTER_WINDOW: 5,
  MOVING_AVERAGE_WINDOW: 7,
  EMA_ALPHA: 0.25,
  BASELINE_FACTOR: 0.992,

  // Audio settings
  BEEP_PRIMARY_FREQUENCY: 880,
  BEEP_SECONDARY_FREQUENCY: 440,
  BEEP_DURATION: 80,
  BEEP_VOLUME: 0.8, 
  MIN_BEEP_INTERVAL_MS: 500, // Reduced from 600 to allow more responsive beeps

  // Signal quality settings
  LOW_SIGNAL_THRESHOLD: 0.06, // Reduced from 0.08 to detect more valid signals
  LOW_SIGNAL_FRAMES: 10 // Reduced from 12 to recover more quickly
};

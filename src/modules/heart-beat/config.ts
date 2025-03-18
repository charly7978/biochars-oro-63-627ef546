
/**
 * Configuration settings for HeartBeatProcessor
 */
export const HeartBeatConfig = {
  // Signal processing settings
  SAMPLE_RATE: 30,
  WINDOW_SIZE: 60,
  MIN_BPM: 40,
  MAX_BPM: 200,
  SIGNAL_THRESHOLD: 0.60,
  MIN_CONFIDENCE: 0.50,
  DERIVATIVE_THRESHOLD: -0.03,
  MIN_PEAK_TIME_MS: 300,
  WARMUP_TIME_MS: 2000,

  // Filter settings
  MEDIAN_FILTER_WINDOW: 3,
  MOVING_AVERAGE_WINDOW: 5,
  EMA_ALPHA: 0.3,
  BASELINE_FACTOR: 0.995,

  // Audio settings
  BEEP_PRIMARY_FREQUENCY: 880,
  BEEP_SECONDARY_FREQUENCY: 440,
  BEEP_DURATION: 80,
  BEEP_VOLUME: 0.8,
  MIN_BEEP_INTERVAL_MS: 250,

  // Signal quality settings
  LOW_SIGNAL_THRESHOLD: 0.05,
  LOW_SIGNAL_FRAMES: 10,
  
  // Arrhythmia visualization settings
  ARRHYTHMIA_INDICATOR_SIZE: 8,
  ARRHYTHMIA_PULSE_COLOR: '#FFDA00', // Yellow pulse start
  ARRHYTHMIA_PULSE_COLOR_END: '#FF2E2E', // Red pulse end
  ARRHYTHMIA_ANIMATION_DURATION_MS: 800,
  ARRHYTHMIA_TRANSITION_DURATION_MS: 180 // Duration for smooth color transition
};

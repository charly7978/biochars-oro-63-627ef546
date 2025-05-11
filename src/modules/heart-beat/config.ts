
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

  // Filter settings - adjusted for direct measurements only
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

  // Signal quality settings - adjusted for direct measurements
  LOW_SIGNAL_THRESHOLD: 0.05,
  LOW_SIGNAL_FRAMES: 10,
  
  // Arrhythmia visualization settings - preserved for real data visualization
  ARRHYTHMIA_INDICATOR_SIZE: 10,
  ARRHYTHMIA_PULSE_COLOR: '#FEF7CD', // Yellow highlight for arrhythmia circles
  ARRHYTHMIA_PULSE_COLOR_END: '#F97316', // Orange text for arrhythmia labels
  ARRHYTHMIA_ANIMATION_DURATION_MS: 800,
  ARRHYTHMIA_TRANSITION_DURATION_MS: 180 // Duration for smooth color transition
};


/**
 * Configuration settings for heart rate monitoring
 */

export const HeartBeatConfig = {
  // Signal processing
  SAMPLE_RATE: 30, // frames per second
  WINDOW_SIZE: 40, // buffer size for signal processing
  LOW_SIGNAL_THRESHOLD: 0.03, // Reducido de 0.05 a 0.03
  LOW_SIGNAL_FRAMES: 8, // Reducido de 10 a 8

  // Heart rate limits (physiological)
  MIN_BPM: 40,
  MAX_BPM: 200,

  // Peak detection
  SIGNAL_THRESHOLD: 0.008, // Reducido de 0.01 a 0.008
  DERIVATIVE_THRESHOLD: 0.004, // Reducido de 0.005 a 0.004
  MIN_CONFIDENCE: 0.35, // Reducido de 0.5 a 0.35
  MIN_PEAK_TIME_MS: 300, // minimum time between peaks (200 BPM)
  WARMUP_TIME_MS: 2000, // Reducido de 3000 a 2000

  // Filtering
  MEDIAN_FILTER_WINDOW: 7,
  MOVING_AVERAGE_WINDOW: 5,
  EMA_ALPHA: 0.3, // alpha for exponential moving average
  BASELINE_FACTOR: 0.95, // factor for baseline tracking
  CALIBRATION_SAMPLES: 80, // Reducido de 100 a 80

  // Beep settings
  BEEP_PRIMARY_FREQUENCY: 667,
  BEEP_SECONDARY_FREQUENCY: 400,
  BEEP_DURATION: 60, // ms
  BEEP_VOLUME: 0.4, // 0-1 scale
  MIN_BEEP_INTERVAL_MS: 250, // minimum time between beeps

  // Special flags - these control different modes
  FORCE_IMMEDIATE_BEEP: false, // force beep on peak detection
  SKIP_TIMING_VALIDATION: false, // skip timing validation for peaks
  
  // Arrhythmia detection
  ARRHYTHMIA_DETECTION_THRESHOLD: 0.12, // Reducido de 0.15 a 0.12
  ARRHYTHMIA_CONSECUTIVE_THRESHOLD: 2, // Reducido de 3 a 2
  
  // Visualization
  SIGNAL_LINE_COLOR: '#00c853',
  PEAK_MARKER_COLOR: '#ff1744',
  ARRHYTHMIA_MARKER_COLOR: '#ff9100'
};

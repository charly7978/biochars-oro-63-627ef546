
/**
 * Configuration settings for heart rate monitoring
 */

export const HeartBeatConfig = {
  // Signal processing
  SAMPLE_RATE: 30, // frames per second
  WINDOW_SIZE: 40, // buffer size for signal processing
  LOW_SIGNAL_THRESHOLD: 0.02, // Significantly reduced from 0.03 to detect weaker signals
  LOW_SIGNAL_FRAMES: 6, // Reduced from 8 to 6 to be less strict

  // Heart rate limits (physiological)
  MIN_BPM: 40,
  MAX_BPM: 200,

  // Peak detection
  SIGNAL_THRESHOLD: 0.005, // Reduced from 0.008 to 0.005
  DERIVATIVE_THRESHOLD: 0.002, // Reduced from 0.004 to 0.002
  MIN_CONFIDENCE: 0.15, // Reduced from 0.35 to 0.15
  MIN_PEAK_TIME_MS: 300, // minimum time between peaks (200 BPM)
  WARMUP_TIME_MS: 1500, // Reduced from 2000 to 1500

  // Filtering
  MEDIAN_FILTER_WINDOW: 7,
  MOVING_AVERAGE_WINDOW: 5,
  EMA_ALPHA: 0.3, // alpha for exponential moving average
  BASELINE_FACTOR: 0.95, // factor for baseline tracking
  CALIBRATION_SAMPLES: 60, // Reduced from 80 to 60

  // Beep settings
  BEEP_PRIMARY_FREQUENCY: 667,
  BEEP_SECONDARY_FREQUENCY: 400,
  BEEP_DURATION: 60, // ms
  BEEP_VOLUME: 0.4, // 0-1 scale
  MIN_BEEP_INTERVAL_MS: 250, // minimum time between beeps

  // Special flags - these control different modes
  FORCE_IMMEDIATE_BEEP: true, // Changed from false to true to force beep on peak detection
  SKIP_TIMING_VALIDATION: true, // Changed from false to true to skip timing validation for peaks
  
  // Arrhythmia detection
  ARRHYTHMIA_DETECTION_THRESHOLD: 0.08, // Greatly reduced from 0.12 to 0.08
  ARRHYTHMIA_CONSECUTIVE_THRESHOLD: 1, // Reduced from 2 to 1
  
  // Visualization
  SIGNAL_LINE_COLOR: '#00c853',
  PEAK_MARKER_COLOR: '#ff1744',
  ARRHYTHMIA_MARKER_COLOR: '#ff9100'
};

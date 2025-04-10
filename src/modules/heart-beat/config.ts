
/**
 * Configuration settings for heart rate monitoring
 */

export const HeartBeatConfig = {
  // Signal processing
  SAMPLE_RATE: 30, // frames per second
  WINDOW_SIZE: 40, // buffer size for signal processing
  LOW_SIGNAL_THRESHOLD: 0.05, // amplitude threshold for weak signal detection
  LOW_SIGNAL_FRAMES: 10, // consecutive weak frames to trigger reset

  // Heart rate limits (physiological)
  MIN_BPM: 40,
  MAX_BPM: 200,

  // Peak detection
  SIGNAL_THRESHOLD: 0.01, // minimum signal value to consider as potential peak
  DERIVATIVE_THRESHOLD: 0.005, // derivative threshold for peak detection
  MIN_CONFIDENCE: 0.5, // minimum confidence for peak confirmation
  MIN_PEAK_TIME_MS: 300, // minimum time between peaks (200 BPM)
  WARMUP_TIME_MS: 3000, // initial warmup period for calibration

  // Filtering
  MEDIAN_FILTER_WINDOW: 7,
  MOVING_AVERAGE_WINDOW: 5,
  EMA_ALPHA: 0.3, // alpha for exponential moving average
  BASELINE_FACTOR: 0.95, // factor for baseline tracking
  CALIBRATION_SAMPLES: 100, // samples to collect before full calibration

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
  ARRHYTHMIA_DETECTION_THRESHOLD: 0.15,
  ARRHYTHMIA_CONSECUTIVE_THRESHOLD: 3,
  
  // Visualization
  SIGNAL_LINE_COLOR: '#00c853',
  PEAK_MARKER_COLOR: '#ff1744',
  ARRHYTHMIA_MARKER_COLOR: '#ff9100'
};


/**
 * Configuration constants for the heart beat processor
 */

export const HeartBeatConfig = {
  // Signal processing parameters
  SAMPLE_RATE: 30,           // Expected sampling rate in Hz
  WINDOW_SIZE: 60,           // Signal processing window size
  SIGNAL_THRESHOLD: 0.05,    // Minimum amplitude for peak detection
  MIN_CONFIDENCE: 0.25,      // Minimum confidence for peak confirmation
  DERIVATIVE_THRESHOLD: 0.008, // Threshold for derivative-based peak detection
  MIN_PEAK_TIME_MS: 300,     // Minimum time between peaks (ms)
  WARMUP_TIME_MS: 2000,      // Initial warmup period (ms)

  // Filter parameters
  MEDIAN_FILTER_WINDOW: 5,   // Window size for median filter
  MOVING_AVERAGE_WINDOW: 5,  // Window size for moving average filter
  EMA_ALPHA: 0.3,            // Alpha factor for exponential moving average
  BASELINE_FACTOR: 0.95,     // Factor for baseline adjustment
  
  // Physiological limits
  MIN_BPM: 40,               // Minimum physiologically valid BPM
  MAX_BPM: 200,              // Maximum physiologically valid BPM
  
  // Audio feedback parameters
  BEEP_PRIMARY_FREQUENCY: 550,   // Primary beep frequency (Hz)
  BEEP_SECONDARY_FREQUENCY: 1100, // Secondary beep frequency (Hz)
  BEEP_DURATION: 100,        // Beep duration (ms)
  BEEP_VOLUME: 0.2,          // Beep volume (0-1)
  MIN_BEEP_INTERVAL_MS: 250, // Minimum time between beeps (ms)
  
  // Signal quality thresholds
  LOW_SIGNAL_THRESHOLD: 0.05, // Threshold for low signal detection
  LOW_SIGNAL_FRAMES: 10,     // Consecutive low signal frames to trigger reset
  
  // Special flags
  FORCE_IMMEDIATE_BEEP: false, // Flag to force immediate beep on peak detection
  SKIP_TIMING_VALIDATION: false // Flag to skip timing validation for testing
};

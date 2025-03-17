
/**
 * Configuration constants for the vital signs processors
 * Centralized configuration for easier maintenance and updates
 */
export const ProcessorConfig = {
  // Signal processing configuration
  WINDOW_SIZE: 300,
  SPO2_CALIBRATION_FACTOR: 1.0,
  PERFUSION_INDEX_THRESHOLD: 0.03, // Reduced from 0.05 to be more permissive
  SPO2_WINDOW: 8,
  SMA_WINDOW: 3,
  
  // Arrhythmia detection configuration
  RR_WINDOW_SIZE: 5,
  RMSSD_THRESHOLD: 25,
  ARRHYTHMIA_LEARNING_PERIOD: 3000,
  PEAK_THRESHOLD: 0.25, // Reduced from 0.3 for more permissive peak detection
  
  // Signal quality thresholds
  MIN_SIGNAL_AMPLITUDE: 0.005, // Reduced from 0.01 for more permissive quality
  MIN_PPG_VALUES: 10, // Reduced from 15 to require fewer values
  WEAK_SIGNAL_THRESHOLD: 0.003, // Reduced from 0.005 for more permissive detection
  
  // Buffer sizes
  SPO2_BUFFER_SIZE: 10,
  BP_BUFFER_SIZE: 10,
  
  // Blood pressure parameters
  BP_ALPHA: 0.7
};

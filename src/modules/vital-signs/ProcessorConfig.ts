
/**
 * Configuration constants for the vital signs processors
 * Centralized configuration for easier maintenance and updates
 */
export const ProcessorConfig = {
  // Signal processing configuration
  WINDOW_SIZE: 300,
  SPO2_CALIBRATION_FACTOR: 1.0,
  PERFUSION_INDEX_THRESHOLD: 0.01, // Reduced even further from 0.02 to be much more permissive
  SPO2_WINDOW: 8,
  SMA_WINDOW: 3,
  
  // Arrhythmia detection configuration
  RR_WINDOW_SIZE: 5,
  RMSSD_THRESHOLD: 25,
  ARRHYTHMIA_LEARNING_PERIOD: 3000,
  PEAK_THRESHOLD: 0.15, // Reduced from 0.20 for even more permissive peak detection
  
  // Signal quality thresholds
  MIN_SIGNAL_AMPLITUDE: 0.002, // Reduced further from 0.003 for even more permissive quality
  MIN_PPG_VALUES: 5, // Reduced further to require even fewer values
  WEAK_SIGNAL_THRESHOLD: 0.001, // Reduced further for more permissive detection
  
  // Buffer sizes
  SPO2_BUFFER_SIZE: 10,
  BP_BUFFER_SIZE: 10,
  
  // Blood pressure parameters
  BP_ALPHA: 0.7
};

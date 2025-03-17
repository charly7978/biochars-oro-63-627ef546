
/**
 * Configuration constants for the vital signs processors
 * Centralized configuration for easier maintenance and updates
 */
export const ProcessorConfig = {
  // Signal processing configuration
  WINDOW_SIZE: 300,
  SPO2_CALIBRATION_FACTOR: 1.0,
  PERFUSION_INDEX_THRESHOLD: 0.005, // Drastically reduced from 0.01 to be extremely permissive
  SPO2_WINDOW: 8,
  SMA_WINDOW: 3,
  
  // Arrhythmia detection configuration
  RR_WINDOW_SIZE: 5,
  RMSSD_THRESHOLD: 25,
  ARRHYTHMIA_LEARNING_PERIOD: 3000,
  PEAK_THRESHOLD: 0.10, // Reduced even further from 0.15 for extremely permissive peak detection
  
  // Signal quality thresholds
  MIN_SIGNAL_AMPLITUDE: 0.001, // Reduced dramatically from 0.002 for extremely permissive quality
  MIN_PPG_VALUES: 3, // Reduced to an absolute minimum
  WEAK_SIGNAL_THRESHOLD: 0.0005, // Reduced dramatically for maximum permissiveness
  
  // Buffer sizes
  SPO2_BUFFER_SIZE: 10,
  BP_BUFFER_SIZE: 10,
  
  // Blood pressure parameters
  BP_ALPHA: 0.7
};


/**
 * Configuration constants for the vital signs processors
 * Centralized configuration for easier maintenance and updates
 */
export const ProcessorConfig = {
  // Signal processing configuration
  WINDOW_SIZE: 300,
  SPO2_CALIBRATION_FACTOR: 1.0, // No artificial calibration
  PERFUSION_INDEX_THRESHOLD: 0.05,
  SPO2_WINDOW: 8,
  SMA_WINDOW: 8,
  RR_WINDOW_SIZE: 15,
  
  // Arrhythmia detection configuration
  RMSSD_THRESHOLD: 22,
  ARRHYTHMIA_LEARNING_PERIOD: 1200,
  PEAK_THRESHOLD: 0.45,
  
  // Signal quality thresholds
  WEAK_SIGNAL_THRESHOLD: 0.10,
  
  // Buffer sizes
  SPO2_BUFFER_SIZE: 10,
  BP_BUFFER_SIZE: 10,
  
  // Blood pressure parameters
  BP_ALPHA: 0.7
};

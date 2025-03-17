
/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 * 
 * Configuration constants for the vital signs processors
 * Centralized configuration for easier maintenance and updates
 */
export const ProcessorConfig = {
  // Signal processing configuration for genuine data
  WINDOW_SIZE: 300,
  SPO2_CALIBRATION_FACTOR: 1.0,
  PERFUSION_INDEX_THRESHOLD: 0.05,
  SPO2_WINDOW: 8,
  SMA_WINDOW: 3,
  
  // Arrhythmia detection configuration for real signals
  RR_WINDOW_SIZE: 5,
  RMSSD_THRESHOLD: 25,
  ARRHYTHMIA_LEARNING_PERIOD: 3000,
  PEAK_THRESHOLD: 0.3,
  
  // Signal quality thresholds for medical-grade analysis
  MIN_SIGNAL_AMPLITUDE: 0.01,
  MIN_PPG_VALUES: 15,
  WEAK_SIGNAL_THRESHOLD: 0.005,
  
  // Buffer sizes for stability
  SPO2_BUFFER_SIZE: 10,
  BP_BUFFER_SIZE: 10,
  
  // Blood pressure parameters
  BP_ALPHA: 0.7
};

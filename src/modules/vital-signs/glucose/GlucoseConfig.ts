
/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 * 
 * Configuration constants for the glucose processor
 * Centralized configuration for easier maintenance and updates
 * For processing of genuine signals only
 */
export const GlucoseConfig = {
  // Sample requirements
  MIN_SAMPLES: 20,
  
  // Analysis factors for real data processing
  PERFUSION_FACTOR: 0.5,
  AMPLITUDE_FACTOR: 0.15,
  FREQUENCY_FACTOR: 0.20,
  PHASE_FACTOR: 0.10,
  AREA_UNDER_CURVE_FACTOR: 0.12,
  
  // Window sizes for signal stability
  SIGNAL_WINDOW_SIZE: 5,
  STABILITY_WINDOW: 5,
  
  // Physiological constraints (mg/dL)
  MIN_GLUCOSE: 80,
  MAX_GLUCOSE: 140,
  
  // Base glucose level (mg/dL)
  GLUCOSE_BASELINE: 100
};

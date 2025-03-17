
/**
 * Configuration constants for the glucose processor
 * Centralized configuration for easier maintenance and updates
 */
export const GlucoseConfig = {
  // Sample requirements
  MIN_SAMPLES: 20,
  
  // Baseline values
  GLUCOSE_BASELINE: 90, // Standard fasting reference
  
  // Signal analysis factors
  PERFUSION_FACTOR: 0.5,
  AMPLITUDE_FACTOR: 0.15,
  FREQUENCY_FACTOR: 0.20,
  PHASE_FACTOR: 0.10,
  AREA_UNDER_CURVE_FACTOR: 0.12,
  
  // Window sizes
  SIGNAL_WINDOW_SIZE: 5,
  STABILITY_WINDOW: 5,
  
  // Physiological constraints (mg/dL)
  MIN_GLUCOSE: 80,
  MAX_GLUCOSE: 140
};

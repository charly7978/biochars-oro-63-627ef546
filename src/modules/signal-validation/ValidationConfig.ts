
/**
 * Configuration constants for signal validation
 */
export const ValidationConfig = {
  // Quality thresholds - significantly reduced for much more permissive validation
  MIN_QUALITY_THRESHOLD: 45,  // Reduced from 80
  CONSECUTIVE_VALID_SAMPLES: 4, // Reduced from 8
  REFRACTORY_PERIOD_MS: 800,   // Reduced from 1200
  MAX_NOISE_RATIO: 0.25,      // Increased from 0.15
  MIN_AMPLITUDE_VARIATION: 0.3, // Reduced from 0.5
  MIN_AMPLITUDE_THRESHOLD: 0.8, // Reduced from 1.2
  
  // History buffer sizes
  QUALITY_HISTORY_SIZE: 15,
  AMPLITUDE_HISTORY_SIZE: 15,
  NOISE_BUFFER_SIZE: 20,
  
  // Quality validation ratios
  MIN_QUALITY_RATIO: 0.7      // Reduced from 0.8
};

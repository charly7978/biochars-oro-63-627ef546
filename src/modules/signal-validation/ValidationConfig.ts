
/**
 * Configuration constants for signal validation
 */
export const ValidationConfig = {
  // Quality thresholds
  MIN_QUALITY_THRESHOLD: 80,
  CONSECUTIVE_VALID_SAMPLES: 8,
  REFRACTORY_PERIOD_MS: 1200,
  MAX_NOISE_RATIO: 0.15,
  MIN_AMPLITUDE_VARIATION: 0.5,
  MIN_AMPLITUDE_THRESHOLD: 1.2,
  
  // History buffer sizes
  QUALITY_HISTORY_SIZE: 15,
  AMPLITUDE_HISTORY_SIZE: 15,
  NOISE_BUFFER_SIZE: 20,
  
  // Quality validation ratios
  MIN_QUALITY_RATIO: 0.8
};

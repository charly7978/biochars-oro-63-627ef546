
/**
 * Configuration for heart beat processing
 */
export const HeartBeatConfig = {
  // Signal thresholds
  LOW_SIGNAL_THRESHOLD: 0.05,
  PEAK_THRESHOLD: 0.25,
  
  // Timing constraints
  MIN_BPM: 40,
  MAX_BPM: 200,
  
  // Signal quality parameters
  LOW_SIGNAL_FRAMES: 10,
  CONFIDENCE_THRESHOLD: 0.4,
  
  // Arrhythmia detection settings
  MIN_RR_INTERVALS: 5,
  ARRHYTHMIA_THRESHOLD: 0.2,
  
  // Processing settings
  FILTER_WINDOW_SIZE: 10,
  PEAK_WINDOW_SIZE: 5,
  
  // WebGPU settings
  USE_WEBGPU: true,
  WEBGPU_BATCH_SIZE: 64
};

/**
 * Calculate heart rate from RR interval
 * @param rrInterval RR interval in milliseconds
 * @returns Heart rate in beats per minute
 */
export function calculateBPM(rrInterval: number): number {
  if (!rrInterval || rrInterval <= 0) return 0;
  return Math.round(60000 / rrInterval);
}

/**
 * Calculate RR interval from heart rate
 * @param bpm Heart rate in beats per minute
 * @returns RR interval in milliseconds
 */
export function calculateRRInterval(bpm: number): number {
  if (!bpm || bpm <= 0) return 0;
  return Math.round(60000 / bpm);
}

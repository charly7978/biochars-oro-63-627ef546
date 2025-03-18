
/**
 * Configuration settings for HeartBeatProcessor
 */
export const HeartBeatConfig = {
  // Signal processing settings
  SAMPLE_RATE: 30,
  WINDOW_SIZE: 60,
  MIN_BPM: 40,
  MAX_BPM: 200,
  SIGNAL_THRESHOLD: 0.55,    // Slightly reduced for better sensitivity
  MIN_CONFIDENCE: 0.45,      // Slightly reduced for better detection
  DERIVATIVE_THRESHOLD: -0.025,  // Adjusted for smoother transitions
  MIN_PEAK_TIME_MS: 280,     // Slightly reduced for better responsiveness
  WARMUP_TIME_MS: 2000,

  // Filter settings
  MEDIAN_FILTER_WINDOW: 3,
  MOVING_AVERAGE_WINDOW: 5,
  EMA_ALPHA: 0.35,           // Increased for better response to changes
  BASELINE_FACTOR: 0.997,    // Increased for better baseline stability

  // Audio settings
  BEEP_PRIMARY_FREQUENCY: 880,
  BEEP_SECONDARY_FREQUENCY: 440,
  BEEP_DURATION: 80,
  BEEP_VOLUME: 0.8,
  MIN_BEEP_INTERVAL_MS: 250,

  // Signal quality settings
  LOW_SIGNAL_THRESHOLD: 0.05,
  LOW_SIGNAL_FRAMES: 10,
  
  // Arrhythmia display settings
  ARRHYTHMIA_PULSE_COLOR: '#FFDA00',       // Color amarillo para el círculo inicial
  ARRHYTHMIA_PULSE_COLOR_END: '#FF2E2E',   // Color rojo para la animación final
  ARRHYTHMIA_INDICATOR_SIZE: 8,            // Tamaño del indicador de arritmia
  ARRHYTHMIA_ANIMATION_DURATION_MS: 800    // Duración de la animación pulsante
};

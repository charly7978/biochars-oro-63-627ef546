
/**
 * Configuration settings for HeartBeatProcessor
 */
export const HeartBeatConfig = {
  // Signal processing settings
  SAMPLE_RATE: 30,
  WINDOW_SIZE: 60,
  MIN_BPM: 40,
  MAX_BPM: 200,
  SIGNAL_THRESHOLD: 0.55,  // Reducido de 0.60 para mejorar sensibilidad
  MIN_CONFIDENCE: 0.45,    // Reducido para capturar más señales
  DERIVATIVE_THRESHOLD: -0.03,
  MIN_PEAK_TIME_MS: 300,
  WARMUP_TIME_MS: 1800,    // Reducido para iniciar más rápido

  // Filter settings
  MEDIAN_FILTER_WINDOW: 3,
  MOVING_AVERAGE_WINDOW: 7,  // Aumentado para suavizar más la señal
  EMA_ALPHA: 0.25,          // Ajustado para respuesta más suave
  BASELINE_FACTOR: 0.992,   // Ajustado para mejor estabilidad de línea base

  // Audio settings
  BEEP_PRIMARY_FREQUENCY: 880,
  BEEP_SECONDARY_FREQUENCY: 440,
  BEEP_DURATION: 80,
  BEEP_VOLUME: 0.8,
  MIN_BEEP_INTERVAL_MS: 250,

  // Signal quality settings
  LOW_SIGNAL_THRESHOLD: 0.04,  // Reducido para detectar señales más débiles
  LOW_SIGNAL_FRAMES: 8         // Reducido para respuesta más rápida
};

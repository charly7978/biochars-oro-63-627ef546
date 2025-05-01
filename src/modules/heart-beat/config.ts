
/**
 * Configuration settings for HeartBeatProcessor
 */
export const HeartBeatConfig = {
  // Signal processing settings
  SAMPLE_RATE: 30,
  WINDOW_SIZE: 60,
  MIN_BPM: 40,
  MAX_BPM: 200,
  SIGNAL_THRESHOLD: 0.65, // Aumentado de 0.60 para reducir falsos positivos
  MIN_CONFIDENCE: 0.55, // Aumentado de 0.50 para mayor confiabilidad
  DERIVATIVE_THRESHOLD: -0.045, // Ajustado de -0.03 para mejorar detección
  MIN_PEAK_TIME_MS: 350, // Aumentado de 300 para evitar detecciones demasiado juntas
  WARMUP_TIME_MS: 2500, // Aumentado de 2000 para mejor estabilización inicial

  // Filter settings - adjusted for direct measurements only
  MEDIAN_FILTER_WINDOW: 5, // Aumentado de 3
  MOVING_AVERAGE_WINDOW: 7, // Aumentado de 5
  EMA_ALPHA: 0.25, // Ajustado de 0.3 para un suavizado más fuerte
  BASELINE_FACTOR: 0.992, // Ajustado de 0.995 para mejor adaptación

  // Audio settings
  BEEP_PRIMARY_FREQUENCY: 880,
  BEEP_SECONDARY_FREQUENCY: 440,
  BEEP_DURATION: 80,
  BEEP_VOLUME: 0.8,
  MIN_BEEP_INTERVAL_MS: 300, // Aumentado de 250 para evitar beeps muy seguidos

  // Signal quality settings - adjusted for direct measurements
  LOW_SIGNAL_THRESHOLD: 0.07, // Aumentado de 0.05 para mejor discriminación
  LOW_SIGNAL_FRAMES: 12, // Aumentado de 10 para reducir sensibilidad al ruido
  
  // Arrhythmia visualization settings - preserved for real data visualization
  ARRHYTHMIA_INDICATOR_SIZE: 10,
  ARRHYTHMIA_PULSE_COLOR: '#FEF7CD', // Yellow highlight for arrhythmia circles
  ARRHYTHMIA_PULSE_COLOR_END: '#F97316', // Orange text for arrhythmia labels
  ARRHYTHMIA_ANIMATION_DURATION_MS: 800,
  ARRHYTHMIA_TRANSITION_DURATION_MS: 180 // Duration for smooth color transition
};

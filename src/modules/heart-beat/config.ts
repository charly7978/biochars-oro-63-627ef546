
/**
 * Configuration settings for HeartBeatProcessor
 */
export const HeartBeatConfig = {
  // Signal processing settings - OPTIMIZADOS
  SAMPLE_RATE: 30,
  WINDOW_SIZE: 60,
  MIN_BPM: 40,
  MAX_BPM: 200,
  SIGNAL_THRESHOLD: 0.55, // Reducido para mejor sensibilidad
  MIN_CONFIDENCE: 0.45, // Reducido para captar más picos
  DERIVATIVE_THRESHOLD: -0.035, // Ajustado para mejorar detección
  MIN_PEAK_TIME_MS: 300, // Reducido para no perder latidos rápidos
  WARMUP_TIME_MS: 2000, // Reducido para ver resultados más rápido

  // Filter settings - OPTIMIZADOS
  MEDIAN_FILTER_WINDOW: 5, 
  MOVING_AVERAGE_WINDOW: 7, 
  EMA_ALPHA: 0.3, // Aumentado para seguir cambios más rápido
  BASELINE_FACTOR: 0.993, // Ajustado para mejor adaptación

  // Audio settings
  BEEP_PRIMARY_FREQUENCY: 880,
  BEEP_SECONDARY_FREQUENCY: 440,
  BEEP_DURATION: 80,
  BEEP_VOLUME: 0.8,
  MIN_BEEP_INTERVAL_MS: 300,

  // Signal quality settings - AJUSTADOS
  LOW_SIGNAL_THRESHOLD: 0.06, // Reducido para menos falsos negativos
  LOW_SIGNAL_FRAMES: 10, // Reducido para respuesta más rápida
  
  // Arrhythmia visualization settings
  ARRHYTHMIA_INDICATOR_SIZE: 10,
  ARRHYTHMIA_PULSE_COLOR: '#FEF7CD',
  ARRHYTHMIA_PULSE_COLOR_END: '#F97316',
  ARRHYTHMIA_ANIMATION_DURATION_MS: 800,
  ARRHYTHMIA_TRANSITION_DURATION_MS: 180
};

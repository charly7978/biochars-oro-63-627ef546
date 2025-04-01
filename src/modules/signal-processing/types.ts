
/**
 * Señal PPG procesada por el procesador unificado
 */
export interface ProcessedPPGSignal {
  // Información temporal
  timestamp: number;
  
  // Valores de señal
  rawValue: number;
  filteredValue: number;
  amplifiedValue: number;
  normalizedValue: number;
  
  // Análisis de frecuencia cardíaca
  isPeak: boolean;
  peakConfidence: number;
  instantaneousBPM: number;
  rrInterval: number | null;
  heartRateVariability?: number;
  
  // Métricas de calidad
  quality: number;
  fingerDetected: boolean;
  signalStrength: number;
  
  // Estado de arritmia
  arrhythmiaCount: number;
}

/**
 * Señal de latido cardíaco procesada
 */
export interface ProcessedHeartbeatSignal {
  // Información temporal
  timestamp: number;
  
  // Valores de señal
  rawValue: number;
  filteredValue: number;
  amplifiedValue: number;
  
  // Análisis de latido
  isPeak: boolean;
  peakConfidence: number;
  instantaneousBPM: number;
  heartRate: number;
  
  // Métricas de calidad
  quality: number;
  rrIntervals: number[];
  
  // Estado de arritmia
  isArrhythmia: boolean;
  arrhythmiaCount: number;
}

/**
 * Error durante el procesamiento
 */
export interface ProcessingError {
  code: string;
  message: string;
  timestamp: number;
  name?: string;
}

/**
 * Interfaz para procesadores de señal
 */
export interface SignalProcessor<T> {
  processSignal(value: number): T;
  configure(options: SignalProcessingOptions): void;
  reset(): void;
}

/**
 * Opciones de configuración para el procesador unificado
 */
export interface SignalProcessingOptions {
  // Configuración de procesamiento
  bufferSize?: number;
  sampleRate?: number;
  
  // Umbrales y sensibilidad
  peakDetectionThreshold?: number;
  qualityThreshold?: number;
  
  // Amplificación y filtrado
  amplificationFactor?: number;
  useAdvancedFiltering?: boolean;
  filterStrength?: number;
  peakThreshold?: number;
  minPeakDistance?: number;
  fingerDetectionSensitivity?: number;
  
  // Control adaptativo
  useAdaptiveControl?: boolean;
  qualityEnhancedByPrediction?: boolean;
  adaptationRate?: number;
  predictionHorizon?: number;
  
  // Callbacks
  onSignalReady?: (signal: any) => void;
  onError?: (error: Error) => void;
}

/**
 * Métricas de calidad de señal
 */
export interface SignalQualityMetrics {
  quality: number;
  strength: number;
  stability: number;
  noiseLevel: number;
}

/**
 * Opciones para el procesador unificado
 */
export interface UnifiedProcessorOptions extends SignalProcessingOptions {
  // Opciones adicionales específicas
}

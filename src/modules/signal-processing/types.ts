
/**
 * Tipos para el procesamiento de señales
 */

/**
 * Opciones de configuración para procesadores de señal
 */
export interface SignalProcessingOptions {
  amplificationFactor?: number;
  filterStrength?: number;
  qualityThreshold?: number;
  fingerDetectionSensitivity?: number;
  useAdaptiveControl?: boolean;
  qualityEnhancedByPrediction?: boolean;
  // Nuevas opciones para control más fino
  predictionWeight?: number;
  correctionThreshold?: number;
  signalEnhancementAmount?: number;
  // Opciones adicionales necesarias para adaptive-predictor
  adaptationRate?: number;
  predictionHorizon?: number;
}

/**
 * Datos de mejora de señal para transparencia
 */
export interface EnhancementMetadata {
  wasEnhanced: boolean;
  enhancementAmount: number;
  predictionQuality: number;
  adaptiveControlEnabled: boolean;
}

/**
 * Interfaz para una señal PPG procesada
 */
export interface ProcessedPPGSignal {
  timestamp: number;
  rawValue: number;
  filteredValue: number;
  normalizedValue: number;
  amplifiedValue: number;
  quality: number;
  fingerDetected: boolean;
  signalStrength: number;
}

/**
 * Interfaz para una señal de latido cardíaco procesada
 */
export interface ProcessedHeartbeatSignal {
  timestamp: number;
  value: number;
  rawValue: number; // Valor original sin procesar
  isPeak: boolean;
  peakConfidence: number;
  instantaneousBPM: number | null;
  rrInterval: number | null;
  heartRateVariability: number | null;
  enhancementMetadata: EnhancementMetadata; // Metadata de transparencia
}

/**
 * Interfaz genérica para procesadores de señal
 */
export interface SignalProcessor<T> {
  processSignal(value: number): T;
  configure(options: SignalProcessingOptions): void;
  reset(): void;
}

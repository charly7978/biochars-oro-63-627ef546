
/**
 * Tipos para el procesamiento central de señales
 */

/**
 * Resultado del procesamiento de señal PPG
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
 * Resultado del procesamiento de señal cardíaca
 */
export interface ProcessedHeartbeatSignal {
  timestamp: number;
  value: number;
  isPeak: boolean;
  peakConfidence: number;
  instantaneousBPM: number | null;
  rrInterval: number | null;
  heartRateVariability: number | null;
}

/**
 * Opciones de configuración para el procesamiento de señal
 */
export interface SignalProcessingOptions {
  amplificationFactor?: number;
  filterStrength?: number;
  qualityThreshold?: number;
  fingerDetectionSensitivity?: number;
}

/**
 * Interfaz para todos los procesadores de señal
 */
export interface SignalProcessor<T> {
  processSignal(value: number): T;
  reset(): void;
  configure(options: SignalProcessingOptions): void;
}


/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Type definitions for signal processing module
 */

/**
 * Options for signal processors
 */
export interface SignalProcessingOptions {
  // Signal amplification factor
  amplificationFactor?: number;
  
  // Filter strength (0-1)
  filterStrength?: number;
  
  // Quality threshold for detection
  qualityThreshold?: number;
  
  // Sensitivity for finger detection
  fingerDetectionSensitivity?: number;
  
  // Use adaptive control for processing
  useAdaptiveControl?: boolean;
  
  // Use prediction to enhance quality
  qualityEnhancedByPrediction?: boolean;
  
  // Prediction horizon in samples
  predictionHorizon?: number;
  
  // Adaptation rate
  adaptationRate?: number;
}

/**
 * Generic interface for signal processors
 */
export interface SignalProcessor<T> {
  processSignal(value: number): T;
  configure(options: Partial<SignalProcessingOptions>): void;
  reset(): void;
}

/**
 * Result from PPG signal processing
 */
export interface ProcessedPPGSignal {
  // Timestamp
  timestamp: number;
  
  // Signal values
  rawValue: number;
  filteredValue: number;
  normalizedValue: number;
  amplifiedValue: number;
  
  // Quality metrics
  quality: number;
  fingerDetected: boolean;
  signalStrength: number;
}

/**
 * Result from heartbeat processing
 */
export interface ProcessedHeartbeatSignal {
  // Timestamp
  timestamp: number;
  
  // Input value
  value: number;
  
  // Peak detection
  isPeak: boolean;
  peakConfidence: number;
  
  // Heart rate
  instantaneousBPM: number | null;
  
  // HRV metrics
  rrInterval: number | null;
  heartRateVariability: number | null;
}

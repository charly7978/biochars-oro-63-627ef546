
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Type definitions for signal processing
 */

/**
 * Processed PPG signal data
 */
export interface ProcessedPPGSignal {
  timestamp: number;
  rawValue: number;
  filteredValue: number;
  normalizedValue: number;
  quality: number;
  fingerDetected: boolean;
}

/**
 * Processed heartbeat signal data
 */
export interface ProcessedHeartbeatSignal {
  timestamp: number;
  value: number;
  isPeak: boolean;
  bpm: number;
  rrInterval: number | null;
  confidence: number;
}

/**
 * Configuration options for signal processing
 */
export interface SignalProcessingOptions {
  filterStrength?: number;
  qualityThreshold?: number;
  adaptiveFiltering?: boolean;
  fingerDetectionSensitivity?: number;
}

/**
 * Interface for optimized signal channels
 */
export interface OptimizedSignalChannel {
  type: string;
  processSignal(signal: number): any;
  calculateQuality(signal: number): number;
  reset(): void;
}

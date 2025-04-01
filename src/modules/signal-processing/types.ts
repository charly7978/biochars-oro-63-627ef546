
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Type definitions for signal processing
 */

import { VitalSignType } from "./channels/SpecializedChannel";

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
  amplifiedValue: number;
  signalStrength: number;
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
  instantaneousBPM: number | null;
  heartRateVariability: number | null;
  rrData?: {
    intervals: number[];
    lastPeakTime: number | null;
  };
}

/**
 * Configuration options for signal processing
 */
export interface SignalProcessingOptions {
  filterStrength?: number;
  qualityThreshold?: number;
  adaptiveFiltering?: boolean;
  fingerDetectionSensitivity?: number;
  amplificationFactor?: number;
  useAdaptiveControl?: boolean;
  qualityEnhancedByPrediction?: boolean;
  adaptationRate?: number;
  predictionHorizon?: number;
}

/**
 * Interface for optimized signal channels
 */
export interface OptimizedSignalChannel {
  type: VitalSignType;
  id: string;
  processSignal(signal: number): any;
  processValue(signal: number): any;
  calculateQuality(signal: number): number;
  getQuality(): number;
  reset(): void;
  applyFeedback(feedback: any): void;
}

/**
 * Interface for signal processors
 */
export interface SignalProcessor {
  processSignal(signal: number): any;
  reset(): void;
  configure(options: Partial<SignalProcessingOptions>): void;
}

// Export the types
export { VitalSignType };

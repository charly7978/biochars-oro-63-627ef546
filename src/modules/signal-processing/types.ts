
/**
 * Tipos para procesamiento de señal
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
  metadata?: {
    rrIntervals?: number[];
    lastPeakTime?: number | null;
    isPeak?: boolean;
    [key: string]: any;
  };
}

export interface SignalProcessorConfig {
  filterParams?: {
    lowPassCutoff?: number;
    highPassCutoff?: number;
    smoothingFactor?: number;
  };
  amplification?: {
    gain?: number;
    adaptiveGain?: boolean;
  };
  fingerDetection?: {
    threshold?: number;
    stabilityThreshold?: number;
  };
}

export interface SignalProcessor {
  processSignal(value: number, timestamp?: number): ProcessedPPGSignal;
  setConfig(config: SignalProcessorConfig): void;
  reset(): void;
}

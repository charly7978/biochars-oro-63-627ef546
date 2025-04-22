
/**
 * Processed Signal from PPG
 */
export interface ProcessedSignal {
  timestamp: number;
  rawValue: number;
  rawGreenValue?: number;
  rawBlueValue?: number;
  filteredValue: number;
  fingerDetected: boolean;
  quality: number;
  perfusionIndex?: number;
  roi?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  spectrumData?: {
    frequencies: number[];
    amplitudes: number[];
    dominantFrequency: number;
  };
}

/**
 * Processing Error
 */
export interface ProcessingError {
  code: string;
  message: string;
  timestamp: number;
}

/**
 * Interface that must be implemented by all signal processors
 */
export interface SignalProcessor {
  initialize: () => Promise<void>;
  start: () => void;
  stop: () => void;
  calibrate: () => Promise<boolean>;
  onSignalReady?: (signal: ProcessedSignal) => void;
  onError?: (error: ProcessingError) => void;
}

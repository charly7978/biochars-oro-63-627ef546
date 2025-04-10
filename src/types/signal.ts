
/**
 * Type definitions for signal processing
 */

/**
 * Processed signal data structure
 */
export interface ProcessedSignal {
  timestamp: number;
  rawValue: number;
  filteredValue: number;
  quality: number;
  fingerDetected: boolean;
  roi: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  perfusionIndex?: number;
  spectrumData?: {
    frequencies: number[];
    amplitudes: number[];
    dominantFrequency: number;
  };
}

/**
 * Error during signal processing
 */
export interface ProcessingError {
  code: string;
  message: string;
  timestamp: number;
}

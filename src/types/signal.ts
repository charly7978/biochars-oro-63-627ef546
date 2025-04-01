
/**
 * Signal types for the application
 */

// Basic signal point with timestamp
export interface SignalPoint {
  value: number;
  timestamp: number;
}

// Region of interest in an image
export interface ROI {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Processed signal with quality metrics
export interface ProcessedSignal {
  timestamp: number;
  rawValue: number;
  filteredValue: number;
  quality: number;
  fingerDetected: boolean;
  roi: ROI;
  perfusionIndex?: number;
}

// Error in signal processing
export interface ProcessingError {
  code: string;
  message: string;
  timestamp: number;
}

// Interface for signal processor
export interface SignalProcessor {
  processFrame(imageData: ImageData): void;
  start(): void;
  stop(): void;
  resetToDefault(): void;
  initialize(): Promise<void>;
}

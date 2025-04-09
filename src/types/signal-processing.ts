
/**
 * Types for signal processing
 */

export interface SignalPoint {
  value: number;
  timestamp: number;
}

export interface TimestampedPoint {
  timestamp: number;
  [key: string]: any;
}

export enum ProcessingPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface SignalProcessingOptions {
  enhanceSignal?: boolean;
  useKalmanFilter?: boolean;
  useMedianFilter?: boolean;
  useTensorFlow?: boolean;
  bufferSize?: number;
  sampleRate?: number;
  peakThreshold?: number;
  [key: string]: any;
}

export interface ProcessingResult {
  value: number;
  timestamp: number;
  quality: number;
  confidence?: number;
}

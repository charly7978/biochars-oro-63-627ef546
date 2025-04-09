
/**
 * Interface for processed PPG signal
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
  };
  perfusionIndex: number;
}

/**
 * Interface for processing errors
 */
export interface ProcessingError {
  code: string;
  message: string;
  timestamp: number;
}

/**
 * Interface for general signal processor
 */
export interface SignalProcessor {
  onSignalReady?: (signal: ProcessedSignal) => void;
  onError?: (error: ProcessingError) => void;
  initialize(): Promise<void>;
  start(): void;
  stop(): void;
  processFrame(imageData: ImageData): void;
}

/**
 * Enum for vital sign types
 */
export enum VitalSignType {
  HEART_RATE = 'heartRate',
  SPO2 = 'spo2',
  BLOOD_PRESSURE = 'bloodPressure',
  ARRHYTHMIA = 'arrhythmia',
  GLUCOSE = 'glucose',
  LIPIDS = 'lipids'
}

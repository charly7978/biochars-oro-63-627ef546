
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
  spectrumData?: {          // Adding spectrumData that was missing
    frequencies: number[];
    amplitudes: number[];
    dominantFrequency: number;
  };
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

/**
 * Return type for vital signs processor hook
 */
export interface UseVitalSignsProcessorReturn {
  processSignal: (value: number, rrData?: any) => any;
  reset: () => void;
  fullReset: () => void;
  arrhythmiaCounter: number;
  lastValidResults: any | null;
  arrhythmiaWindows: Array<{ start: number, end: number }>;
  debugInfo: any;
}

/**
 * Interface for vital signs result with confidence
 */
export interface VitalSignsResult {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  lastArrhythmiaData?: any;
  confidence?: {
    glucose: number;
    lipids: number;
    overall: number;
  };
}

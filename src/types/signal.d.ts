
export interface FilterOptions {
  medianWindowSize: number;
  movingAvgWindowSize: number;
  emaAlpha: number;
}

export interface ProcessingError {
  code: string;
  message: string;
  details?: any;
  timestamp?: number;  // Added timestamp property
}

export interface ProcessedSignal {
  filteredValue: number;
  quality: number;
  timestamp: number;
  rawValue?: number;   // Added rawValue property
  fingerDetected?: boolean;
  roi?: {  // Added roi property
    x: number;
    y: number;
    width: number;
    height: number;
  };
  perfusionIndex?: number;
  spectrumData?: any;
}

// Added SignalProcessor interface
export interface SignalProcessor {
  initialize(): Promise<void>;
  start(): void;
  stop(): void;
  calibrate(): Promise<boolean>;
  processFrame(imageData: ImageData): void;
  onSignalReady?: (signal: ProcessedSignal) => void;
  onError?: (error: ProcessingError) => void;
}

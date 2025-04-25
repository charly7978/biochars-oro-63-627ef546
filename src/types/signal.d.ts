
export interface FilterOptions {
  medianWindowSize: number;
  movingAvgWindowSize: number;
  emaAlpha: number;
}

export interface ProcessingError {
  code: string;
  message: string;
  details?: any;
  timestamp?: number;
}

export interface ProcessedSignal {
  filteredValue: number;
  quality: number;
  timestamp: number;
  rawValue?: number;
  fingerDetected?: boolean;
  roi?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  perfusionIndex?: number;
  spectrumData?: any;
}

export interface SignalProcessor {
  initialize(): Promise<void>;
  start(): void;
  stop(): void;
  calibrate(): Promise<boolean>;
  processFrame(imageData: ImageData): void;
  onSignalReady?: (signal: ProcessedSignal) => void;
  onError?: (error: ProcessingError) => void;
}

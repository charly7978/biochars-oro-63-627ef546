
export interface ProcessedSignal {
  timestamp: number;
  rawValue: number;
  filteredValue: number;
  quality: number;
  roi: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  perfusionIndex: number;
  spectrumData?: {
    frequencies: number[];
    amplitudes: number[];
    dominantFrequency: number;
  };
}

export interface ProcessingError {
  code: string;
  message: string;
  timestamp: number;
}

export interface SignalProcessor {
  onSignalReady?: (signal: ProcessedSignal) => void;
  onError?: (error: ProcessingError) => void;
  initialize(): Promise<void>;
  start(): void;
  stop(): void;
  processFrame(imageData: ImageData): void;
  calibrate(): Promise<void>;
}

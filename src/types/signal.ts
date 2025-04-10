
/**
 * Processed signal data interface
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
}

/**
 * Processing error interface
 */
export interface ProcessingError {
  code: string;
  message: string;
  timestamp: number;
}

/**
 * Heart beat result interface
 */
export interface HeartBeatResult {
  bpm: number; 
  confidence: number;
  isArrhythmia: boolean;
  arrhythmiaCount: number;
  rrData: {
    intervals: number[];
    lastPeakTime: number | null;
  };
}

/**
 * Interface for signal processors
 */
export interface ISignalProcessor {
  initialize(): Promise<void>;
  start(): void;
  stop(): void;
  reset(): void;
  applySMAFilter(value: number): number;
  getPPGValues(): number[];
  onSignalReady?: (signal: ProcessedSignal) => void;
  onError?: (error: ProcessingError) => void;
}

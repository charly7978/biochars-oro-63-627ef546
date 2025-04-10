
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

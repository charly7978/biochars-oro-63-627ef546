
/**
 * Processed Signal from PPG
 */
export interface ProcessedSignal {
  timestamp: number;
  rawValue: number;
  rawGreenValue?: number;
  rawBlueValue?: number;
  filteredValue: number;
  fingerDetected: boolean;
  quality: number;
}

/**
 * Processing Error
 */
export interface ProcessingError {
  code: string;
  message: string;
  timestamp: number;
}

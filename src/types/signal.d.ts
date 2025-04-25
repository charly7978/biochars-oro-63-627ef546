
export interface FilterOptions {
  medianWindowSize: number;
  movingAvgWindowSize: number;
  emaAlpha: number;
}

export interface ProcessingError {
  code: string;
  message: string;
  details?: any;
}

export interface ProcessedSignal {
  filteredValue: number;
  quality: number;
  timestamp: number;
}

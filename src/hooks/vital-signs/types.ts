
/**
 * Interface for arrhythmia visualization window
 */
export interface ArrhythmiaWindow {
  start: number;
  end: number;
  isActive?: boolean;
}

/**
 * Interface for signal quality parameters
 */
export interface SignalQualityParams {
  lowSignalThreshold: number;
  maxWeakSignalCount: number;
}

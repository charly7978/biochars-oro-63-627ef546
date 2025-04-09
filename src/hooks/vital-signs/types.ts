
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

/**
 * Return type for useVitalSignsProcessor hook
 */
export interface UseVitalSignsProcessorReturn {
  processSignal: (value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => any;
  reset: () => any;
  fullReset: () => void;
  arrhythmiaCounter: number;
  lastValidResults: any | null;
  arrhythmiaWindows?: ArrhythmiaWindow[];
  debugInfo?: any;
}

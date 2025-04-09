
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

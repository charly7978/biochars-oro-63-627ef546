
export interface ArrhythmiaWindow {
  start: number;
  end: number;
  intensity?: number;
  category?: string;
}

export interface UseVitalSignsProcessorReturn {
  processSignal: (value: number, rrData?: any) => any;
  reset: () => any;
  fullReset: () => void;
  arrhythmiaCounter: number;
  lastValidResults: any;
  arrhythmiaWindows: ArrhythmiaWindow[];
  debugInfo: any;
}


export interface ArrhythmiaWindow {
  id: string;
  start: number;
  end: number;
  type: 'irregular' | 'bigeminy' | 'tachycardia' | 'bradycardia' | 'forced';
  intensity: number;
}

export interface UseVitalSignsProcessorReturn {
  processSignal: (value: number, rrData?: any) => any;
  reset: () => void;
  fullReset: () => void;
  arrhythmiaCounter: number;
  lastValidResults: any | null;
  arrhythmiaWindows: ArrhythmiaWindow[];
  debugInfo: any;
}

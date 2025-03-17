
import { VitalSignsResult } from '../../modules/vital-signs/VitalSignsProcessor';
import { ArrhythmiaProcessor } from '../../modules/arrhythmia-processor';

export interface ArrhythmiaWindow {
  start: number;
  end: number;
}

export interface VitalSignsProcessorHookReturn {
  processSignal: (value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => VitalSignsResult;
  reset: () => void;
  fullReset: () => void;
  getArrhythmiaProcessor: () => ArrhythmiaProcessor | null;
  arrhythmiaCounter: number;
  lastValidResults: VitalSignsResult | null;
  arrhythmiaWindows: ArrhythmiaWindow[];
  debugInfo: {
    processedSignals: number;
    signalLog: {timestamp: number, value: number, result: any}[];
  };
}

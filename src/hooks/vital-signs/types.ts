
import { ArrhythmiaWindow } from '@/types/arrhythmia';
import { VitalSignsResult } from '../../modules/vital-signs/types/vital-signs-result';

export interface UseVitalSignsProcessorReturn {
  processSignal: (value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => VitalSignsResult;
  reset: () => VitalSignsResult | null;
  fullReset: () => void;
  arrhythmiaCounter: number;
  lastValidResults: VitalSignsResult | null;
  arrhythmiaWindows: ArrhythmiaWindow[];
  debugInfo: {
    processedSignals: number;
    signalLog: { timestamp: number, value: number, result: any }[];
  };
}

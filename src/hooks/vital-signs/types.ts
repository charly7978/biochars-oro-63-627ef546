
import { VitalSignsResult } from '../../modules/vital-signs/types/vital-signs-result';

export interface UseVitalSignsProcessorReturn {
  processSignal: (value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => Promise<VitalSignsResult>;
  reset: () => VitalSignsResult | null;
  fullReset: () => void;
  arrhythmiaCounter?: number;
  lastValidResults: VitalSignsResult | null;
  arrhythmiaWindows: any[];
  debugInfo: any;
}

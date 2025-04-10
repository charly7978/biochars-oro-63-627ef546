
import { VitalSignsResult } from "../../modules/vital-signs/types/vital-signs-result";

/**
 * Return type for useVitalSignsProcessor hook
 */
export interface UseVitalSignsProcessorReturn {
  processSignal: (value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => VitalSignsResult | null;
  reset: () => VitalSignsResult | null;
  fullReset: () => void;
  arrhythmiaCounter: number;
  lastValidResults: VitalSignsResult | null;
  arrhythmiaWindows: {start: number, end: number}[];
  debugInfo: any;
}


import { VitalSignsResult } from '../../modules/vital-signs/types/vital-signs-result';
import { ArrhythmiaWindow } from '../../services/ArrhythmiaDetectionService';

export interface UseVitalSignsProcessorReturn {
  processSignal: (value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => VitalSignsResult;
  reset: () => null;
  fullReset: () => void;
  arrhythmiaCounter: number;
  lastValidResults: VitalSignsResult | null;
  arrhythmiaWindows: ArrhythmiaWindow[];
  debugInfo: Record<string, any>;
  processFrame?: (imageData: ImageData) => any;  // Added missing property
}

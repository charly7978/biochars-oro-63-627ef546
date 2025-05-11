
import { VitalSignsResult } from "../../modules/vital-signs/types/vital-signs-result";
import { ArrhythmiaWindow } from "./use-arrhythmia-visualization";

export interface UseVitalSignsProcessorReturn {
  processSignal: (value: number) => VitalSignsResult;
  reset: () => VitalSignsResult | null;
  fullReset: () => void;
  arrhythmiaCounter: number;
  lastValidResults: VitalSignsResult | null;
  arrhythmiaWindows: ArrhythmiaWindow[];
  debugInfo: {
    processedSignals: number;
    signalLog: any[];
  };
}

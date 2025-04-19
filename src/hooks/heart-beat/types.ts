
import { VitalSignsResult } from "../../modules/vital-signs/types/vital-signs-result";

export interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  arrhythmiaCount?: number;
  isArrhythmia?: boolean;
  rrData: {
    intervals: number[];
    lastPeakTime: number | null;
  };
}

export interface UseHeartBeatReturn {
  currentBPM: number;
  confidence: number;
  processSignal: (value: number) => HeartBeatResult;
  reset: () => void;
  isArrhythmia: boolean;
  requestBeep: (value: number) => boolean;
  startProcessing: () => void; // Add this line
  stopProcessing: () => void;  // Add this line
  startMonitoring: () => void;
  stopMonitoring: () => void;
}

export interface UseVitalSignsProcessorReturn {
  processSignal: (value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => VitalSignsResult;
  reset: () => VitalSignsResult | null;
  fullReset: () => void;
  applyBloodPressureCalibration: (systolic: number, diastolic: number) => void; // Add this line
  arrhythmiaCounter: number;
  lastValidResults: VitalSignsResult | null;
  arrhythmiaWindows: { start: number, end: number }[];
  debugInfo: {
    processedSignals: number;
    ppgBufferLength: number;
    arrhythmiaCounter: number;
    processorActive: boolean;
    signalLog: { timestamp: number; value: number; result: any; }[];
  };
}


/**
 * Types for vital signs processing
 */

export interface HeartRateResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  isArrhythmia: boolean;
  arrhythmiaCount: number;
}

export interface OxygenSaturationResult {
  spO2: number;
  confidence: number;
}

export interface RespirationRateResult {
  rpm: number;
  confidence: number;
}

export interface BloodPressureResult {
  systolic: number;
  diastolic: number;
  confidence: number;
}

export interface StressLevelResult {
  level: number;
  confidence: number;
}

export interface VitalSignsResult {
  heartRate: HeartRateResult;
  oxygenSaturation: OxygenSaturationResult;
  respirationRate: RespirationRateResult;
  bloodPressure: BloodPressureResult;
  stressLevel: StressLevelResult;
}

export interface ArrhythmiaWindow {
  start: number;
  end: number;
}

export interface UseVitalSignsProcessorReturn {
  processSignal: (value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => any;
  reset: () => any;
  fullReset: () => void;
  arrhythmiaCounter: number;
  lastValidResults: VitalSignsResult | null;
  arrhythmiaWindows: ArrhythmiaWindow[];
  debugInfo: any;
}

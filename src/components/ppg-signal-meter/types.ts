
export interface PPGDataPoint {
  time: number;
  value: number;
  isArrhythmia?: boolean;
}

export interface ArrhythmiaTransition {
  active: boolean;
  startTime: number;
  endTime: number | null;
}

export interface ArrhythmiaSegment {
  startTime: number;
  endTime: number | null;
}

export interface Peak {
  time: number;
  value: number;
  isArrhythmia?: boolean;
}

export interface PPGSignalMeterProps {
  value: number;
  quality: number;
  isFingerDetected: boolean;
  onStartMeasurement: () => void;
  onReset: () => void;
  arrhythmiaStatus?: string;
  rawArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
  preserveResults?: boolean;
  isArrhythmia?: boolean;
}

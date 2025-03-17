
export interface VitalSignsResult {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  calibration?: {
    phase: 'initial' | 'calibrating' | 'completed';
    progress: {
      heartRate: number;
      spo2: number;
      pressure: number;
      arrhythmia: number;
    };
  };
  lastArrhythmiaData?: any;
}

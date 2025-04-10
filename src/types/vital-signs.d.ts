export interface VitalSignsResult {
  spO2: number;
  bloodPressure: {
    systolic: number;
    diastolic: number;
  };
  glucose: number;
  lipids: LipidsResult;
  hydration: number;
  arrhythmia: ArrhythmiaProcessingResult | null;
}

export interface LipidsResult {
  totalCholesterol: number;
  triglycerides: number;
}

export interface ArrhythmiaProcessingResult {
  arrhythmiaStatus: string;
  confidence: number;
}

export interface RRData {
  intervals: number[];
  lastPeakTime: number | null;
} 
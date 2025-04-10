export interface VitalSignsResult {
  spo2: number;
  pressure: {
    systolic: number;
    diastolic: number;
  };
  glucose: number;
  lipids: LipidsResult;
  hydration: number;
  arrhythmia: ArrhythmiaProcessingResult | null;
  confidence: number;
  timestamp: number;
}

export interface LipidsResult {
  totalCholesterol: number;
  triglycerides: number;
}

export interface ArrhythmiaProcessingResult {
  arrhythmiaStatus: string;
  confidence: number;
  type?: string;
}

export interface RRData {
  intervals: number[];
  lastPeakTime: number | null;
} 
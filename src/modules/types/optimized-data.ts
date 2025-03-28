
/**
 * Definiciones de tipos para los datos optimizados del sistema
 */

export interface OptimizedHeartRate {
  timestamp: number;
  heartRate: number;
  confidence: number;
}

export interface OptimizedSPO2 {
  timestamp: number;
  spo2: number;
  confidence: number;
}

export interface OptimizedBloodPressure {
  timestamp: number;
  systolic: number;
  diastolic: number;
  display: string;
  confidence: number;
}

export interface OptimizedGlucose {
  timestamp: number;
  value: number;
  confidence: number;
}

export interface OptimizedLipids {
  timestamp: number;
  totalCholesterol: number;
  triglycerides: number;
  confidence: number;
}

export interface OptimizedArrhythmia {
  timestamp: number;
  rmssd: number;
  rrVariation: number;
  detectionProbability: number;
  windows?: [number, number][];
  detected?: boolean;
}

export interface VitalSignsResult {
  timestamp: number;
  heartRate: number;
  spo2: number;
  pressure?: string;
  bloodPressure?: {
    systolic: number;
    diastolic: number;
    display: string;
  };
  glucose?: number;
  lipids?: {
    totalCholesterol: number;
    triglycerides: number;
  };
  reliability: number;
  arrhythmiaStatus?: string;
  arrhythmiaData?: OptimizedArrhythmia;
}

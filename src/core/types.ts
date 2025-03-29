
// Add missing types referenced in VitalSignsProcessor.ts

export interface UserProfile {
  age: number;
  gender: string;
  height: number;
  weight: number;
}

export interface VitalSignsResult {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  }
}

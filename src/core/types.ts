
export interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  arrhythmiaCount: number;
  rrData?: {
    intervals: number[];
    lastPeakTime: number | null;
  };
  isArrhythmia?: boolean;
  fingerDetected?: boolean;  // Add this property to fix the type error
}

export interface ProcessedSignal {
  value: number;
  timestamp: number;
  quality: number;
  filteredValue: number;
}

export interface UserProfile {
  age: number;
  gender?: 'male' | 'female' | 'unknown';
  height?: number; // cm
  weight?: number; // kg
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  medicalConditions?: string[];
  smokingStatus?: 'non_smoker' | 'former_smoker' | 'smoker';
  ethnicity?: string;
}

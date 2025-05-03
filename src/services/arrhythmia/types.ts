
import { ArrhythmiaWindow } from '@/types/arrhythmia';

export type ArrhythmiaListener = (result: ArrhythmiaDetectionResult) => void;

export interface ArrhythmiaDetectionResult {
  isArrhythmia: boolean;
  rmssd: number;
  rrVariation: number;
  timestamp: number;
  category?: 'normal' | 'possible-arrhythmia' | 'bigeminy' | 'tachycardia' | 'bradycardia';
}

export type ArrhythmiaCategory = 'normal' | 'possible-arrhythmia' | 'bigeminy' | 'tachycardia' | 'bradycardia';

export interface ArrhythmiaStatus {
  arrhythmiaCount: number;
  statusMessage: string;
  lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
    category?: string;
  } | null;
}

export interface UserProfile {
  age?: number;
  condition?: 'athlete' | 'hypertension' | 'diabetes';
}

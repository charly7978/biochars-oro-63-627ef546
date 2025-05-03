
import { ArrhythmiaWindow } from '@/types/arrhythmia';

export type ArrhythmiaListener = (window: ArrhythmiaWindow) => void;

export type ArrhythmiaCategory = 'normal' | 'possible-arrhythmia' | 'bigeminy' | 'tachycardia' | 'bradycardia';

export interface ArrhythmiaDetectionResult {
  isArrhythmia: boolean;
  rmssd: number;
  rrVariation: number;
  timestamp: number;
  category?: ArrhythmiaCategory;
}

export interface ArrhythmiaStatus {
  arrhythmiaCount: number;
  statusMessage: string;
  lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
    category?: ArrhythmiaCategory;
  } | null;
}

export interface UserProfile {
  age?: number;
  condition?: 'athlete' | 'hypertension' | 'diabetes';
}

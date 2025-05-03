
import { ArrhythmiaData } from '@/types/arrhythmia';

/**
 * Represents the result of an arrhythmia detection operation
 */
export interface ArrhythmiaDetectionResult {
  timestamp: number;
  rmssd: number;
  rrVariation: number;
  isArrhythmia: boolean;
}

/**
 * Represents a window of time where an arrhythmia was detected
 */
export interface ArrhythmiaWindow {
  start: number;
  end: number;
  timestamp?: number;
  rmssd?: number;
  rrVariation?: number;
  isArrhythmia?: boolean;
}

/**
 * Current arrhythmia detection status
 */
export interface ArrhythmiaStatus {
  statusMessage: string;
  lastArrhythmiaData: ArrhythmiaData | null;
}

/**
 * Listener for arrhythmia events
 */
export type ArrhythmiaListener = (result: ArrhythmiaDetectionResult) => void;

/**
 * User profile for personalized arrhythmia detection
 */
export interface UserProfile {
  age?: number;
  gender?: 'male' | 'female' | 'other';
  rmssdThreshold?: number;
  variationThreshold?: number;
  baselineHeartRate?: number;
  knownConditions?: string[];
}

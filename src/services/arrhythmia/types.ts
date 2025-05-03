
/**
 * Tipos para el servicio de detección de arritmias
 */

export type ArrhythmiaStatus = 
  'normal' | 
  'possible-arrhythmia' | 
  'arrhythmia' | 
  'bigeminy' | 
  'trigeminy' | 
  'tachycardia' | 
  'bradycardia' | 
  'possible-afib' |
  'unknown';

export interface ArrhythmiaDetectionResult {
  timestamp: number;
  status: ArrhythmiaStatus;
  probability: number; // 0-1
  signalQuality: number; // 0-100
  details: Record<string, any>; // Detalles adicionales
  latestIntervals: number[]; // Últimos intervalos RR en ms
  isArrhythmia?: boolean; // Propiedad opcional para compatibilidad
}

export type ArrhythmiaListener = (result: ArrhythmiaDetectionResult) => void;

export interface UserProfile {
  age: number;
  gender: 'male' | 'female' | 'other';
  restingHeartRate: number;
  knownConditions: string[];
  medications: string[];
}

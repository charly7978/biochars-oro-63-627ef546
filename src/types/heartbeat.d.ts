
/**
 * Tipos para los datos relacionados con latidos cardíacos
 * Esto es necesario para los analizadores de presión arterial
 */

export interface HeartBeatData {
  timestamp: number;
  bpm: number;
  confidence: number;
  intervals?: number[];
  amplitude?: number;
  isPeak?: boolean;
}

export interface RRIntervalData {
  intervals: number[];
  timestamps?: number[];
  lastPeakTime: number | null;
}

export interface ArrhythmiaDetectionResult {
  isArrhythmia: boolean;
  confidence: number;
  type?: string;
  severity?: number;
  rmssd?: number;
  rrVariation?: number;
}

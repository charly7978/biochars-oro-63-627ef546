
export interface ArrhythmiaWindow {
  timestamp: number;
  duration: number;
  status: string; // O usar ArrhythmiaStatus desde el servicio
  intervals: number[];
  probability: number;
  details: Record<string, any>;
}

export interface ArrhythmiaData {
  timestamp: number;
  rmssd: number;
  rrVariation: number;
}

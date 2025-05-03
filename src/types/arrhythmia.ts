
export interface ArrhythmiaWindow {
  start: number;
  end: number;
}

export interface ArrhythmiaData {
  timestamp: number;
  rmssd: number;
  rrVariation: number;
  category?: string; // This is already defined as optional
}

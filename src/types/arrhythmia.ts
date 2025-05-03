
import { ArrhythmiaStatus } from "@/services/arrhythmia/types";

export interface ArrhythmiaWindow {
  timestamp: number;
  duration: number;
  status: ArrhythmiaStatus; 
  intervals: number[];
  probability: number;
  details: Record<string, any>;
  // Add properties to match expected type in PPGSignalMeter
  start?: number;
  end?: number;
}

export interface ArrhythmiaData {
  timestamp: number;
  rmssd: number;
  rrVariation: number;
}


/**
 * Result interface for vital signs measurements
 */
export interface VitalSignsResult {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  lastArrhythmiaData?: {
    timestamp: number;
    data?: {
      rmssd: number;
      rrVariation: number;
    };
  } | {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
}

/**
 * Interface for arrhythmia detection results
 */
export interface ArrhythmiaDetectionResult {
  status: string;
  data: {
    rmssd?: number;
    rrVariation?: number;
  };
}


/**
 * Interface for vital signs measurement result
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
  hemoglobin: number;
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
  glucoseConfidence?: number;
  lipidsConfidence?: number;
  overallConfidence?: number;
}

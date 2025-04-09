
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
  lastArrhythmiaData?: any;
  confidence?: {
    glucose: number;
    lipids: number;
    overall: number;
  };
}

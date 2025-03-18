
/**
 * Interface for vital signs measurement results
 * Direct measurement only - no simulation data
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
    rmssd?: number;
    rrVariation?: number;
  } | null;
  confidence?: {
    glucose: number;
    lipids: number;
    overall: number;
  };
}

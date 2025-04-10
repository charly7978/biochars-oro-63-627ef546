
import { ArrhythmiaData } from '../../../core/analysis/ArrhythmiaDetector';

/**
 * Standard interface for vital signs results
 * Used across different components and modules
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
  calibration?: {
    isCalibrating: boolean;
    progress: {
      heartRate: number;
      spo2: number;
      pressure: number;
      arrhythmia: number;
      glucose: number;
      lipids: number;
      hemoglobin: number;
    };
  };
  lastArrhythmiaData?: ArrhythmiaData | null;
}

/**
 * Interface for confidence values related to vital signs measurements
 */
export interface VitalSignsConfidence {
  glucose: number;
  lipids: number;
  overall: number;
}

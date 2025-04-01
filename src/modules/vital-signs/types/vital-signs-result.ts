
/**
 * Type definitions for vital signs processing results
 */

// Base result interface for vital signs processing
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
}

// Define the interface for precision metrics
export interface PrecisionMetrics {
  calibrationConfidence: number;
  measurementVariance: number;
  signalQualityScore: number;
  crossValidationScore: number;
  environmentalAdjustmentFactor: number;
}

// Define the interface for arrhythmia detection results
export interface ArrhythmiaDetectionResult {
  isArrhythmia: boolean;
  type: string;
  confidence: number;
  rmssd?: number;
  rrVariation?: number;
  anomalies?: Array<{
    timestamp: number;
    type: string;
    magnitude: number;
  }>;
}


/**
 * Types for vital signs data
 */

// RR interval data for heart rate variability analysis
export interface RRIntervalData {
  intervals: number[];
  lastPeakTime: number | null;
}

// Vital signs result interface
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
    spo2: number;
    bloodPressure?: number;
    glucose: number;
    lipids: number;
    overall: number;
  };
}

// Enhanced result with neural processing
export interface EnhancedVitalSignsResult extends VitalSignsResult {
  neuralContribution: number;
  processingTime: number;
  modelVersion?: string;
  enhancementQuality?: number;
}

// Configuration for vital signs processing
export interface VitalSignsProcessorConfig {
  useAI: boolean;
  neuralWeight: number;
  useEnhancement: boolean;
  confidenceThreshold: number;
  diagnosticsEnabled: boolean;
  modelVersions?: {
    spo2?: string;
    bloodPressure?: string;
    glucose?: string;
    lipids?: string;
  };
}

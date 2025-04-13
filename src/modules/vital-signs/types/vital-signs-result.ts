
/**
 * Interface defining the structure of vital signs measurement results
 */
export interface VitalSignsResult {
  // Blood oxygen saturation percentage
  spo2: number;
  
  // Heart rate in BPM
  heartRate: number;
  
  // Blood pressure in format "systolic/diastolic"
  pressure: string;
  
  // Arrhythmia detection status
  arrhythmiaStatus: string;
  
  // Blood glucose level in mg/dL
  glucose: number;
  
  // Blood lipid levels
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  
  // Hemoglobin level (g/dL)
  hemoglobin: number;
  
  // Hydration level (percentage)
  hydration: number;
  
  // Individual confidence values (as separate properties)
  glucoseConfidence?: number;
  lipidsConfidence?: number;
  overallConfidence?: number;
  
  // Information about the last detected arrhythmia event
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
}

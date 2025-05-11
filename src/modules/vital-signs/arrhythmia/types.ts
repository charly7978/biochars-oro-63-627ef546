
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Interface for R-R interval analysis results.
 * Contains data about heart rate variability metrics and potential arrhythmia detection
 * based on DIRECT measurements only.
 */
export interface RRAnalysisResult {
  /**
   * Root Mean Square of Successive Differences - a measure of heart rate variability
   */
  rmssd: number;
  
  /**
   * Relative variation in RR intervals
   */
  rrVariation: number;
  
  /**
   * Timestamp when the analysis was performed
   */
  timestamp: number;
  
  /**
   * Boolean flag indicating whether an arrhythmia was detected
   */
  isArrhythmia: boolean;
}

/**
 * Interface for RR interval data
 */
export interface RRIntervalData {
  intervals: number[];
  lastPeakTime: number | null;
}

/**
 * Interface for arrhythmia processing result
 */
export interface ArrhythmiaProcessingResult {
  arrhythmiaStatus: string;
  lastArrhythmiaData: { 
    timestamp: number; 
    rmssd: number; 
    rrVariation: number; 
  } | null;
}

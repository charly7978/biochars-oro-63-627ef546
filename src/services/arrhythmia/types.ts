
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Define the possible categories of arrhythmias detected
 */
export type ArrhythmiaCategory = 
  | "normal" 
  | "possible-arrhythmia" 
  | "bigeminy" 
  | "tachycardia" 
  | "bradycardia";

/**
 * Interface for arrhythmia detection results
 */
export interface ArrhythmiaDetectionResult {
  /**
   * Indicates if an arrhythmia was detected
   */
  isArrhythmia: boolean;
  
  /**
   * Status message with details about the detection
   */
  statusMessage: string;
  
  /**
   * Additional data about the detected arrhythmia
   */
  lastArrhythmiaData: ArrhythmiaData | null;
  
  /**
   * Count of arrhythmias detected in the current session
   */
  arrhythmiaCount: number;
  
  /**
   * Category of arrhythmia detected
   */
  category: ArrhythmiaCategory;
}

/**
 * Interface for arrhythmia data
 */
export interface ArrhythmiaData {
  /**
   * Timestamp when the arrhythmia was detected
   */
  timestamp: number;
  
  /**
   * Root mean square of successive differences - a measure of heart rate variability
   */
  rmssd: number;
  
  /**
   * RR interval variation - percentage variation between consecutive heartbeats
   */
  rrVariation: number;
  
  /**
   * Category of arrhythmia detected
   */
  category?: ArrhythmiaCategory;
}

/**
 * Interface for arrhythmia status
 */
export interface ArrhythmiaStatus {
  /**
   * Status message with details about the arrhythmia
   */
  statusMessage: string;
  
  /**
   * Additional data about the detected arrhythmia
   */
  lastArrhythmiaData: ArrhythmiaData | null;
  
  /**
   * Category of arrhythmia detected
   */
  category: ArrhythmiaCategory;
}

/**
 * Interface for a callback function that listens for arrhythmia events
 */
export interface ArrhythmiaListener {
  (result: ArrhythmiaDetectionResult): void;
}

/**
 * User profile for arrhythmia analysis customization
 */
export interface UserProfile {
  /**
   * Age of the user in years
   */
  age?: number;
  
  /**
   * Weight of the user in kg
   */
  weight?: number;
  
  /**
   * Height of the user in cm
   */
  height?: number;
  
  /**
   * Known medical conditions of the user
   */
  medicalConditions?: string[];
  
  /**
   * User's resting heart rate if known
   */
  restingHeartRate?: number;
}

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

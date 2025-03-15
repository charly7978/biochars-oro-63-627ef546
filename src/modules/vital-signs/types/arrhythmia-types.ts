
/**
 * Types for arrhythmia detection and processing
 */

export interface ArrhythmiaResult {
  arrhythmiaStatus: string;
  lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
}

export interface RRData {
  intervals: number[];
  lastPeakTime: number | null;
}

export interface NonLinearMetrics {
  shannonEntropy: number;
  sampleEntropy: number;
  pnnX: number;
}

// HRV analysis interfaces
export interface HRVMetrics {
  // Time domain
  rmssd: number;       // Root Mean Square of Successive Differences
  sdnn: number;        // Standard Deviation of NN intervals
  pnn50: number;       // Proportion of NN50
  
  // Frequency domain
  lf: number;          // Low Frequency power
  hf: number;          // High Frequency power
  lfhf: number;        // LF/HF ratio
  
  // Nonlinear measures
  sd1: number;         // Poincaré plot standard deviation perpendicular to line of identity
  sd2: number;         // Poincaré plot standard deviation along line of identity
  entropy: number;     // Approximate entropy
}

export interface TimeMetrics {
  rmssd: number;  // Root Mean Square of Successive Differences
  sdnn: number;   // Standard Deviation of NN intervals
  pnn50: number;  // Proportion of NN50
}

export interface FrequencyMetrics {
  lf: number;    // Low Frequency power
  hf: number;    // High Frequency power
  lfhf: number;  // LF/HF ratio
}

export interface NonlinearMetrics {
  sd1: number;     // Poincaré plot SD1
  sd2: number;     // Poincaré plot SD2
  entropy: number; // Approximate entropy
}

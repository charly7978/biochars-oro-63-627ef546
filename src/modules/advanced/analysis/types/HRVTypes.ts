
/**
 * Tipos para el análisis de variabilidad de frecuencia cardíaca (HRV)
 */

/**
 * Métricas estándar de HRV que incluyen dominios de tiempo, frecuencia y no lineales
 */
export interface HRVMetrics {
  // Dominio del tiempo
  rmssd: number;       // Root Mean Square of Successive Differences
  sdnn: number;        // Standard Deviation of NN intervals
  pnn50: number;       // Proportion of NN50
  
  // Dominio de la frecuencia
  lf: number;          // Low Frequency power
  hf: number;          // High Frequency power
  lfhf: number;        // LF/HF ratio
  
  // Medidas no lineales
  sd1: number;         // Poincaré plot standard deviation perpendicular to line of identity
  sd2: number;         // Poincaré plot standard deviation along line of identity
  entropy: number;     // Approximate entropy
}

/**
 * Métricas en el dominio del tiempo
 */
export interface TimeMetrics {
  rmssd: number;  // Root Mean Square of Successive Differences
  sdnn: number;   // Standard Deviation of NN intervals
  pnn50: number;  // Proportion of NN50
}

/**
 * Métricas en el dominio de la frecuencia
 */
export interface FrequencyMetrics {
  lf: number;    // Low Frequency power
  hf: number;    // High Frequency power
  lfhf: number;  // LF/HF ratio
}

/**
 * Métricas de análisis no lineal
 */
export interface NonlinearMetrics {
  sd1: number;     // Poincaré plot SD1
  sd2: number;     // Poincaré plot SD2
  entropy: number; // Approximate entropy
}

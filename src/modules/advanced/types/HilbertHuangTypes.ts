
/**
 * Types for the Hilbert-Huang Transform implementation
 */

/**
 * Función de modo intrínseco (IMF) resultado de la descomposición
 */
export interface IMF {
  values: number[];
  frequency: number;
  amplitude: number;
  phase: number[];
}

/**
 * Resultado del análisis HHT
 */
export interface HilbertHuangResult {
  imfs: IMF[];
  instantaneousFrequency: number[];
  dominantFrequency: number;
}

/**
 * Resultado de la búsqueda de extremos locales
 */
export interface ExtremaResult {
  maxIndices: number[];
  minIndices: number[];
}

/**
 * Resultado de la transformada de Hilbert
 */
export interface HilbertResult {
  amplitude: number[];
  phase: number[];
}

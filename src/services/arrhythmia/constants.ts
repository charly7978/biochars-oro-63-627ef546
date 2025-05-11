
/**
 * Constantes para la detección de arritmias
 */

export const ARRHYTHMIA_CONFIG = {
  windowSize: 30, // Tamaño de ventana de análisis (intervalos RR)
  minIntervalsForAnalysis: 5, // Mínimo de intervalos necesarios para análisis básico
  minIntervalsForAdvancedAnalysis: 10, // Mínimo de intervalos necesarios para análisis avanzado
  minSegmentLength: 200, // Longitud mínima de segmento PPG para análisis morfológico
  minQualityThreshold: 65, // Umbral mínimo de calidad para análisis (0-100)
  lowIrregularityThreshold: 0.2, // Umbral bajo para considerar irregularidad
  highIrregularityThreshold: 0.4, // Umbral alto para considerar irregularidad
  irregularityThreshold: 0.15, // Umbral para considerar un intervalo como irregular
  lowProbabilityThreshold: 0.4, // Umbral bajo para probabilidad de arritmia
  highProbabilityThreshold: 0.7, // Umbral alto para probabilidad de arritmia
  advancedAnalysisFrequency: 10 // Frecuencia de análisis avanzado (cada N ciclos)
};


/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Datos de intervalos RR
 */
export interface RRIntervalData {
  intervals: number[];
  lastPeakTime: number | null;
}

/**
 * Resultado de procesamiento de arritmias
 */
export interface ArrhythmiaProcessingResult {
  arrhythmiaStatus: string;
  lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
}

/**
 * Resultado de análisis de intervalos RR
 */
export interface RRAnalysisResult {
  rmssd: number;
  sdnn: number;
  pnn50: number;
  maxRRRatio: number;
  minRRRatio: number;
}

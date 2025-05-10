
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Datos de intervalos RR calculados a partir de señal PPG
 */
export interface RRIntervalData {
  /**
   * Array de intervalos RR en milisegundos
   */
  intervals: number[];
  
  /**
   * Timestamp del último pico detectado
   */
  lastPeakTime: number | null;
}

/**
 * Resultado de procesamiento de arritmias
 */
export interface ArrhythmiaProcessingResult {
  /**
   * Estado actual de detección de arritmias
   */
  arrhythmiaStatus: string;
  
  /**
   * Datos adicionales sobre la última arritmia detectada
   */
  lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
}

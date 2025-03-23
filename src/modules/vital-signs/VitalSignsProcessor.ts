
/**
 * NOTA IMPORTANTE: Este es un archivo de tipos para mantener compatibilidad.
 * Las interfaces principales están en index.tsx y PPGSignalMeter.tsx que son INTOCABLES.
 */

/**
 * Resultado del procesamiento de signos vitales
 */
export interface VitalSignsResult {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  glucose: number | { value: number; trend: string };
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  hemoglobin: number;
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
  advanced?: any; // Para datos avanzados extensibles
}

/**
 * Datos de intervalos RR para análisis de arritmias
 */
export interface RRData {
  intervals: number[];
  lastPeakTime: number | null;
}

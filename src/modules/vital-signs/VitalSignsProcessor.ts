
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
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  atrialFibrillation?: {
    detected: boolean;
    confidence: number;
    irregularIntervals: number;
  };
  calibration?: {
    isCalibrating: boolean;
    progress: {
      heartRate: number;
      spo2: number;
      pressure: number;
      arrhythmia: number;
      glucose: number;
      lipids: number;
      atrialFibrillation: number;
    };
  };
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
}

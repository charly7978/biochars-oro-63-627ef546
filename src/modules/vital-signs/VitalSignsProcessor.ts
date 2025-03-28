
/**
 * Tipos para resultados de signos vitales
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
  confidence?: {
    glucose: number;
    lipids: number;
    overall: number;
  };
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
    visualWindow?: {
      start: number;
      end: number;
    };
    severity?: 'media' | 'alta';
    type?: string;
  } | null;
}

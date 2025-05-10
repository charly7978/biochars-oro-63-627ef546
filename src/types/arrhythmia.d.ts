
/**
 * Definiciones de tipos para la detección de arritmias
 * CORREGIDO para asegurar compatibilidad total con los objetos pasados entre componentes
 */

export interface ArrhythmiaWindow {
  timestamp: number;
  duration: number;
  status: string;
  intervals: number[];
  probability: number;
  details: Record<string, any>;
  start: number;
  end: number;
}

export interface ArrhythmiaStatus {
  isArrhythmia: boolean;
  type: string;
  lastDetected: Date | null;
}

export interface ArrhythmiaData {
  timestamp: number;
  rmssd: number;
  rrVariation: number;
  intervals?: number[];
  duration?: number;
  probability?: number;
}

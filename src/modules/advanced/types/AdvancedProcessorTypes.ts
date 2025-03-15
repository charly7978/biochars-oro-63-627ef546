
import type { VitalSignsResult } from '../../core/VitalSignsProcessor';
import type { RRData } from '../../core/ArrhythmiaProcessor';

/**
 * Configuración de calibración para el procesador avanzado
 */
export interface CalibrationProgress {
  heartRate: number;
  spo2: number;
  pressure: number;
  arrhythmia: number;
  glucose: number;
  lipids: number;
  hemoglobin: number;
}

/**
 * Estado del procesador y métricas de calidad de señal
 */
export interface ProcessorState {
  ppgValues: number[];
  perfusionIndex: number;
  signalQuality: number;
  pressureArtifactLevel: number;
  isLowPowerMode: boolean;
  lastResult: VitalSignsResult | null;
}

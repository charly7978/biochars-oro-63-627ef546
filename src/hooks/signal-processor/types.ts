
/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 */
import { ProcessedSignal } from '../../types/signal-processor';

export interface SignalStats {
  minValue: number;
  maxValue: number;
  avgValue: number;
  totalValues: number;
}

export interface SignalProcessorState {
  isProcessing: boolean;
  lastSignal: ProcessedSignal | null;
  framesProcessed: number;
  signalStats: SignalStats;
}

export interface DetectionConfig {
  HISTORY_SIZE: number;
  ADAPTIVE_ADJUSTMENT_INTERVAL: number;
  MIN_DETECTION_THRESHOLD: number;
  MAX_SIGNAL_LOCK: number;
  RELEASE_GRACE_PERIOD: number;
}

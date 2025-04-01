
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Common interfaces for signal processing
 */

import { ProcessedHeartbeatSignal, ProcessedPPGSignal, SignalProcessingOptions } from './types';

/**
 * Base signal processor interface
 */
export interface SignalProcessor {
  processSignal(signal: number): any;
  reset(): void;
  configure(options: Partial<SignalProcessingOptions>): void;
}

/**
 * Specific processor for PPG signals
 */
export interface PPGSignalProcessor extends SignalProcessor {
  processSignal(signal: number): ProcessedPPGSignal;
}

/**
 * Specific processor for heartbeat signals
 */
export interface HeartbeatSignalProcessor extends SignalProcessor {
  processSignal(signal: number): ProcessedHeartbeatSignal;
}

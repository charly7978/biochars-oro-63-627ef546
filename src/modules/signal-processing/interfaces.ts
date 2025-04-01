
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Common interfaces for signal processing
 */

import { VitalSignType } from './channels/SpecializedChannel';

/**
 * Interface for optimized signal channels
 */
export interface OptimizedSignalChannel {
  id: string;
  getId(): string;
  getType(): VitalSignType;
  isType(type: VitalSignType): boolean;
  processValue(signal: number): any;
  reset(): void;
  getLatestValue(): number | null;
  getValues(): number[];
  getTimestamps(): number[];
}

/**
 * Interface for channel configuration
 */
export interface ChannelConfiguration {
  enabled: boolean;
  sampleRate?: number;
  adaptationRate?: number;
  bufferSize?: number;
}

/**
 * Signal distributor configuration
 */
export interface SignalDistributorConfig {
  channels?: {
    [key in VitalSignType]?: ChannelConfiguration;
  };
  globalAdaptationRate?: number;
  calibrationMode?: boolean;
}

/**
 * Signal processing result
 */
export interface SignalProcessingResult {
  timestamp: number;
  channelResults: Map<VitalSignType, any>;
  diagnostics?: SignalDiagnosticInfo;
}

/**
 * Signal diagnostic information
 */
export interface SignalDiagnosticInfo {
  quality: number;
  fingerDetected: boolean;
  signalStrength: number;
  processingTime: number;
  adaptationRate: number;
}

/**
 * Blood pressure result
 */
export interface BloodPressureResult {
  systolic: number;
  diastolic: number;
  map?: number;
}

/**
 * Cardiac measurement result
 */
export interface CardiacResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  rrInterval?: number | null;
  hrv?: number | null;
}

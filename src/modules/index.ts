
/**
 * NOTA IMPORTANTE: Este es el punto de entrada para el procesador central de señales.
 * Este módulo se encarga de la exportación del optimizador de señal de 6 canales
 * con feedback bidireccional y toda la funcionalidad integrada.
 */

// Exportar el procesador principal de señales desde el ubicación central
export { 
  SignalProcessor,
  PPGSignalProcessor
} from './core/SignalProcessor';

// Re-exportación de tipos para compatibilidad
export type { ProcessedSignal, ISignalProcessor } from './core/SignalProcessor';
export type { ProcessingError } from '../types/signal';

// Exportamos la implementación del procesador existente para retrocompatibilidad
export { VitalSignsProcessor } from './compat/VitalSignsProcessorAdapter';
export type { VitalSignsResult, RRData } from './vital-signs/VitalSignsProcessor';

// Exportar utilidades relacionadas con procesamiento de señales
export { BloodPressureProcessor } from './core/BloodPressureProcessor';
export { HeartBeatProcessor } from './HeartBeatProcessor';

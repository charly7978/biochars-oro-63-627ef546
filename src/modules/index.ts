
/**
 * NOTA IMPORTANTE: Este es el punto de entrada para el procesador central de señales.
 * Este módulo se encarga de la exportación del optimizador de señal de 6 canales
 * con feedback bidireccional y toda la funcionalidad integrada.
 */

// Exportar el procesador principal de señales 
export { 
  SignalProcessor,
  PPGSignalProcessor 
} from './core/SignalProcessor';

export type { 
  ProcessedSignal,
  ISignalProcessor
} from './core/SignalProcessor';

// Exportamos la implementación del procesador existente para retrocompatibilidad
export { VitalSignsProcessor } from './compat/VitalSignsProcessorAdapter';
export type { VitalSignsResult, RRData } from './vital-signs/VitalSignsProcessor';

// Nota: Se ha eliminado la exportación de módulos duplicados o innecesarios
// para centralizar todo el procesamiento en el optimizador de señales diferencial.

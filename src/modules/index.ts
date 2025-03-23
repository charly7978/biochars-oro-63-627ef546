
/**
 * NOTA IMPORTANTE: Este es el punto de entrada para el procesador central de señales.
 * Este módulo se encarga de la exportación del procesador de señal avanzado
 * con toda la funcionalidad integrada.
 */

// Exportar el procesador avanzado de señales desde la ubicación central
export { AdvancedSignalProcessor } from './advanced/AdvancedSignalProcessor';

// Re-exportación de tipos para compatibilidad
export type { ProcessingError } from '../types/signal';

// Exportamos otros procesadores específicos necesarios
export { BloodPressureProcessor } from './core/BloodPressureProcessor';
export { HeartBeatProcessor } from './HeartBeatProcessor';

// Exportación de adaptador necesario para compatibilidad
export { VitalSignsAdapter } from './compat/VitalSignsAdapter';
export type { VitalSignsResult, RRData } from './vital-signs/VitalSignsProcessor';

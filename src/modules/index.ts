
/**
 * NOTA IMPORTANTE: Este es el punto de entrada para todos los módulos de procesamiento.
 * Las interfaces principales están en index.tsx y PPGSignalMeter.tsx que son INTOCABLES.
 */

// Exportar adaptadores de compatibilidad para uso desde código existente
export { VitalSignsProcessor } from './compat/VitalSignsProcessorAdapter';
export type { VitalSignsResult, RRData } from './vital-signs/VitalSignsProcessor';

// Exportar procesadores principales para uso directo si es necesario
export { SignalProcessor, PPGSignalProcessor } from './core/SignalProcessor';
export type { ProcessedSignal } from './core/SignalProcessor';
export { SpO2Processor } from './core/SpO2Processor';
export { BloodPressureProcessor } from './core/BloodPressureProcessor';
export { ArrhythmiaProcessor } from './core/ArrhythmiaProcessor';
export { VitalSignsProcessor as CoreVitalSignsProcessor } from './core/VitalSignsProcessor';

// Nota: La estructura es modular, cada procesador se encarga solo de su tarea específica
// y se comunica a través de interfaces bien definidas.

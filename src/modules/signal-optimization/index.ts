
/**
 * Exportaciones para el módulo de optimización de señales
 */

// Tipos
export * from './types';

// Optimizador de señal
export { SignalOptimizer, createOptimizer } from './signal-optimizer';

// Optimizador base de canal
export { BaseChannelOptimizer } from './base-channel-optimizer';

// Canales específicos
export { HeartRateOptimizer } from './channels/heart-rate-optimizer';
export { SPO2Optimizer } from './channels/spo2-optimizer';
export { BloodPressureOptimizer } from './channels/blood-pressure-optimizer';
export { GlucoseOptimizer } from './channels/glucose-optimizer';
export { CholesterolOptimizer } from './channels/cholesterol-optimizer';
export { TriglyceridesOptimizer } from './channels/triglycerides-optimizer';


/**
 * Módulo de optimización de señal avanzado
 * Proporciona optimización especializada para cada signo vital
 * con canales independientes y retroalimentación bidireccional
 */

// Exportar los tipos del optimizador
export * from './types';

// Exportar el optimizador central
export * from './signal-optimizer';

// Exportar optimizadores de canal individuales para acceso directo
export * from './channels/heart-rate-optimizer';
export * from './channels/spo2-optimizer';
export * from './channels/blood-pressure-optimizer';
export * from './channels/glucose-optimizer';
export * from './channels/cholesterol-optimizer';
export * from './channels/triglycerides-optimizer';

// Helper para crear instancias
import { createSignalOptimizer } from './signal-optimizer';

/**
 * Crea y configura una nueva instancia del optimizador de señal
 */
export function createOptimizer() {
  return createSignalOptimizer();
}

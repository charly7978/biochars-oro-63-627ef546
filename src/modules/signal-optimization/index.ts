
/**
 * Módulo de optimización de señales PPG
 * Punto de entrada para todas las funcionalidades de optimización
 */

export * from './types';
export * from './signal-optimizer';
export * from './base-channel-optimizer';

// Exportación de función principal
import { createSignalOptimizer } from './signal-optimizer';

/**
 * Crea una nueva instancia del optimizador de señal
 */
export function createOptimizer() {
  return createSignalOptimizer();
}

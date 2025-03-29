
/**
 * Módulo de cálculo y resultados para signos vitales
 * 
 * Implementa algoritmos avanzados de cálculo real basados en señales optimizadas
 * con feedback bidireccional hacia el optimizador
 */

// Exportar tipos principales
export * from './types';

// Exportar procesadores principales
export * from './vital-signs-calculator';
export * from './feedback-manager';

// Exportar calculadores específicos
export * from './calculators/heart-rate-calculator';
export * from './calculators/spo2-calculator';
export * from './calculators/blood-pressure-calculator';
export * from './calculators/glucose-calculator';
export * from './calculators/lipids-calculator';
export * from './calculators/arrhythmia-calculator';

// Factory para crear instancias
import { createVitalSignsCalculator } from './vital-signs-calculator';

/**
 * Crea y configura una nueva instancia del calculador
 */
export function createCalculator() {
  return createVitalSignsCalculator();
}


/**
 * Módulo de cálculo de signos vitales
 * Punto de entrada para todos los calculadores de signos vitales
 */

export * from './types';
export * from './vital-signs-calculator';
export * from './feedback-manager';

// Exportar calculadores específicos
export * from './calculators/heart-rate-calculator';
export * from './calculators/spo2-calculator';
export * from './calculators/blood-pressure-calculator';
export * from './calculators/glucose-calculator';
export * from './calculators/lipids-calculator';
export * from './calculators/arrhythmia-calculator';

import { VitalSignsCalculatorManager } from './vital-signs-calculator';

/**
 * Crea una nueva instancia del calculador de signos vitales
 */
export function createCalculator(): VitalSignsCalculatorManager {
  return new VitalSignsCalculatorManager();
}


/**
 * Tipos para el módulo de cálculo de signos vitales
 */

import { OptimizedSignal } from '../../signal-optimization/types';

// Resultado de cálculo genérico
export interface CalculationResultItem<T = number | string> {
  value: T;
  confidence: number;
  metadata?: Record<string, any>;
}

// Resultado de arrhythmia
export interface ArrhythmiaResultItem {
  status: string;
  data: any;
}

// Resultado completo de cálculo
export interface CalculationResult {
  heartRate: CalculationResultItem<number>;
  spo2: CalculationResultItem<number>;
  bloodPressure: CalculationResultItem<string>;
  glucose: CalculationResultItem<number>;
  cholesterol: CalculationResultItem<number>;
  triglycerides: CalculationResultItem<number>;
  arrhythmia: ArrhythmiaResultItem;
}

// Interfaz base para todos los calculadores
export interface BaseCalculator {
  calculate(signal: OptimizedSignal): CalculationResultItem;
  reset(): void;
}

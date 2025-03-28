
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
  count?: number;
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

// Interfaz para calculador de signo vital con configuración específica
export interface VitalSignCalculator extends BaseCalculator {
  getChannelName(): string;
  getConfidenceLevel(): number;
}

// Configuración para cálculos específicos
export interface VitalSignCalculation {
  minValue: number;
  maxValue: number;
  confidenceThreshold: number;
  defaultValue: number | string;
  value?: number | string;
  confidence?: number;
  timestamp?: number;
  metadata?: Record<string, any>;
}

// Tipos de feedback para optimización
export interface FeedbackData {
  channel: string;
  adjustment: 'increase' | 'decrease' | 'reset' | 'fine-tune';
  magnitude: number;
  parameter?: string;
  confidence?: number;
  additionalData?: any;
}

// Exportar explícitamente usando 'export type' para los tipos
export type { VitalSignCalculation };
export type { BaseCalculator as BaseVitalSignCalculator };

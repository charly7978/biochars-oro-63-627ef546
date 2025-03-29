
/**
 * Tipos para el módulo de cálculo y resultados
 */

import { OptimizedSignal, VitalSignChannel, FeedbackData } from '../../signal-optimization/types';

/**
 * Resultado de cálculo para un signo vital específico
 */
export interface VitalSignCalculation {
  value: number | string;
  confidence: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Resultado completo del cálculo de signos vitales
 */
export interface CalculationResult {
  heartRate: VitalSignCalculation;
  spo2: VitalSignCalculation;
  bloodPressure: VitalSignCalculation;
  glucose: VitalSignCalculation;
  cholesterol: VitalSignCalculation;
  triglycerides: VitalSignCalculation;
  arrhythmia: {
    status: string;
    count: number;
    lastDetection: number | null;
    data: any;
  };
}

/**
 * Estado de cálculo para visualización en gráficos
 */
export interface CalculationVisualizationData {
  ppgData: Array<{
    time: number;
    value: number;
    isPeak: boolean;
    isArrhythmia?: boolean;
  }>;
  arrhythmiaMarkers: Array<{
    startTime: number;
    endTime: number;
    type: string;
  }>;
}

/**
 * Interfaz para calculadores de signos vitales específicos
 */
export interface VitalSignCalculator {
  getChannel(): VitalSignChannel;
  calculate(signal: OptimizedSignal): VitalSignCalculation;
  generateFeedback(): FeedbackData | null;
  reset(): void;
}

/**
 * Interfaz para el calculador principal
 */
export interface VitalSignsCalculatorManager {
  processOptimizedSignals(
    signals: Record<VitalSignChannel, OptimizedSignal | null>
  ): CalculationResult;
  getVisualizationData(): CalculationVisualizationData;
  generateFeedback(): Array<FeedbackData>;
  reset(): void;
}

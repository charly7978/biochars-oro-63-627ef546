
/**
 * Tipos para el módulo de optimización de señal
 */

import { ProcessedPPGSignal } from '../signal-processing/types';

/**
 * Identificador de canal de signo vital
 */
export type VitalSignChannel = 
  | 'heartRate'
  | 'spo2'
  | 'bloodPressure'
  | 'glucose'
  | 'cholesterol'
  | 'triglycerides';

/**
 * Parámetros de ajuste del optimizador
 * Pueden ser ajustados mediante feedback
 */
export interface OptimizationParameters {
  amplificationFactor: number;
  filterStrength: number;
  noiseThreshold: number;
  frequencyRange: [number, number];
  sensitivityFactor: number;
  adaptiveThreshold: boolean;
}

/**
 * Resultado de la señal optimizada para un canal específico
 */
export interface OptimizedSignal {
  channel: VitalSignChannel;
  timestamp: number;
  value: number;
  quality: number;
  optimizedValue: number;
  parameters: OptimizationParameters;
}

/**
 * Interfaz para la retroalimentación del módulo de cálculo
 */
export interface FeedbackData {
  channel: VitalSignChannel;
  confidence: number;
  suggestedAdjustments?: Partial<OptimizationParameters>;
  timestamp: number;
}

/**
 * Configuración del optimizador por canal
 */
export interface ChannelOptimizerConfig {
  channel: VitalSignChannel;
  parameters: OptimizationParameters;
  isEnabled: boolean;
}

/**
 * Optimizador de canal de signo vital
 */
export interface ChannelOptimizer {
  getChannel(): VitalSignChannel;
  optimize(signal: ProcessedPPGSignal): OptimizedSignal;
  processFeedback(feedback: FeedbackData): void;
  getParameters(): OptimizationParameters;
  setParameters(params: Partial<OptimizationParameters>): void;
  reset(): void;
}

/**
 * Gestor principal de optimización
 */
export interface SignalOptimizer {
  optimizeSignal(signal: ProcessedPPGSignal): Record<VitalSignChannel, OptimizedSignal>;
  processFeedback(feedback: FeedbackData): void;
  getOptimizer(channel: VitalSignChannel): ChannelOptimizer | null;
  setChannelConfig(config: ChannelOptimizerConfig): void;
  reset(): void;
}

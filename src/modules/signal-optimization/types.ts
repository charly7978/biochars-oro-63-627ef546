
/**
 * Tipos para el módulo de optimización de señal
 */

import { ProcessedPPGSignal } from '../signal-processing/types';

/**
 * Canales de señal para signos vitales
 */
export type VitalSignChannel = 'heartRate' | 'spo2' | 'bloodPressure' | 'glucose' | 'cholesterol' | 'triglycerides';

/**
 * Parámetros de optimización para canales
 */
export interface OptimizationParameters {
  amplificationFactor: number;
  filterStrength: number;
  noiseThreshold: number;
  frequencyRange: [number, number]; // [min, max] en Hz
  sensitivityFactor: number;
  adaptiveThreshold: boolean;
}

/**
 * Señal optimizada con metadatos
 */
export interface OptimizedSignal {
  channel: VitalSignChannel;
  timestamp: number;
  value: number;
  quality: number;
  optimizedValue: number;
  parameters: OptimizationParameters;
  metadata?: {
    rrIntervals?: number[];
    lastPeakTime?: number | null;
    isPeak?: boolean;
    [key: string]: any;
  };
}

/**
 * Datos de retroalimentación desde el módulo de cálculo
 */
export interface FeedbackData {
  channel: VitalSignChannel;
  confidence: number;
  suggestedAdjustments?: Partial<OptimizationParameters>;
  timestamp: number;
}

/**
 * Configuración para optimizador de canal
 */
export interface ChannelOptimizerConfig {
  channel: VitalSignChannel;
  parameters: Partial<OptimizationParameters>;
}

/**
 * Interfaz para optimizadores de canal
 */
export interface ChannelOptimizer {
  getChannel(): VitalSignChannel;
  getParameters(): OptimizationParameters;
  setParameters(params: Partial<OptimizationParameters>): void;
  optimize(signal: ProcessedPPGSignal): OptimizedSignal;
  processFeedback(feedback: FeedbackData): void;
  reset(): void;
}

/**
 * Interfaz para el optimizador principal
 */
export interface SignalOptimizer {
  optimizeSignal(signal: ProcessedPPGSignal): Record<VitalSignChannel, OptimizedSignal>;
  processFeedback(feedback: FeedbackData): void;
  getOptimizer(channel: VitalSignChannel): ChannelOptimizer | null;
  setChannelConfig(config: ChannelOptimizerConfig): void;
  reset(): void;
}

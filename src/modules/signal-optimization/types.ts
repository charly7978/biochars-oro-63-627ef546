
/**
 * Tipos para módulo de optimización de señales
 */

import { ProcessedPPGSignal } from '../signal-processing/types';

/**
 * Tipo de canal de signo vital
 */
export type VitalSignChannel = 'heartRate' | 'spo2' | 'bloodPressure' | 'glucose' | 'cholesterol' | 'triglycerides';

/**
 * Señal optimizada para cálculo de signos vitales
 */
export interface OptimizedSignal {
  // Identificadores
  channel: VitalSignChannel;
  timestamp: number;
  
  // Valores
  value: number;
  rawValue: number;
  amplified: number;
  filtered: number;
  
  // Calidad
  confidence: number;
  quality: number;
  
  // Metadatos específicos del canal
  metadata?: Record<string, any>;
}

/**
 * Parámetros de optimización
 */
export interface OptimizationParameters {
  // Parámetros de señal
  amplification: number;
  filterStrength: number;
  sensitivity: number;
  smoothing: number;
  
  // Parámetros adicionales de refinamiento
  noiseThreshold: number;
  dynamicRange: number;
  frequencyRange?: [number, number];
}

/**
 * Datos de retroalimentación para optimizador
 */
export interface FeedbackData {
  channel: string;
  adjustment: 'increase' | 'decrease' | 'reset' | 'fine-tune';
  magnitude: number;
  parameter?: string;
  confidence?: number;
  additionalData?: any;
}

/**
 * Interfaz para optimizador de señales
 */
export interface SignalOptimizer {
  optimizeSignal(signal: ProcessedPPGSignal): Record<VitalSignChannel, OptimizedSignal | null>;
  processFeedback(feedback: FeedbackData): void;
  reset(): void;
}

/**
 * Interfaz para optimizador de canal específico
 */
export interface ChannelOptimizer {
  optimize(signal: ProcessedPPGSignal): OptimizedSignal;
  processFeedback(feedback: FeedbackData): void;
  reset(): void;
}

/**
 * Configuración para optimizador de canal
 */
export interface ChannelOptimizerConfig {
  initialParameters: Partial<OptimizationParameters>;
  adaptiveTuning?: boolean;
}

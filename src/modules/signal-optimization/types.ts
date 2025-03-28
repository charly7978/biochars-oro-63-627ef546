
/**
 * Tipos para el módulo de optimización de señal
 */

import { ProcessedPPGSignal } from '../signal-processing/types';

// Canales para signos vitales
export type VitalSignChannel = 'heartRate' | 'spo2' | 'bloodPressure' | 'glucose' | 'cholesterol' | 'triglycerides';

// Señal optimizada
export interface OptimizedSignal {
  channel: VitalSignChannel;
  timestamp: number;
  value: number;
  rawValue: number;
  amplified: number;
  filtered: number;
  confidence: number;
  quality: number;
  metadata?: Record<string, any>;
}

// Datos de retroalimentación para optimización
export interface FeedbackData {
  channel: string;
  adjustment: 'increase' | 'decrease' | 'reset' | 'fine-tune';
  magnitude: number;
  parameter?: string;
  confidence?: number;
  additionalData?: any;
}

// Interfaz para optimizador de canal
export interface ChannelOptimizer {
  optimize(signal: ProcessedPPGSignal): OptimizedSignal;
  processFeedback(feedback: FeedbackData): void;
  reset(): void;
}

// Interfaz para optimizador multicanal
export interface SignalOptimizer {
  optimizeSignal(signal: ProcessedPPGSignal): Record<VitalSignChannel, OptimizedSignal | null>;
  processFeedback(feedback: FeedbackData): void;
  reset(): void;
  getChannelOptimizer(channel: VitalSignChannel): ChannelOptimizer | null;
}

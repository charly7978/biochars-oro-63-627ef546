
/**
 * Tipos para el módulo de optimización de señales
 */

import { ProcessedPPGSignal } from '../signal-processing/types';

// Canales de señal disponibles
export type VitalSignChannel = 'heartRate' | 'spo2' | 'bloodPressure' | 'glucose' | 'cholesterol' | 'triglycerides';

// Nivel de filtrado aplicado
export type FilteringLevel = 'low' | 'medium' | 'high';

// Señal optimizada (salida del optimizador)
export interface OptimizedSignal {
  // Canal asociado
  channel: VitalSignChannel;
  
  // Valor optimizado
  value: number;
  
  // Timestamp
  timestamp: number;
  
  // Confianza (0-1)
  confidence: number;
  
  // Metadatos adicionales específicos del canal
  metadata?: {
    peaks?: boolean;
    intervals?: number[];
    lastPeakTime?: number;
    filteredValues?: number[];
    amplification?: number;
    normalizedValue?: number;
    [key: string]: any;
  };
}

// Parámetros de optimización para cada canal
export interface OptimizationParameters {
  // Factor de amplificación para este canal
  amplificationFactor: number;
  
  // Nivel de filtrado aplicado
  filteringLevel: FilteringLevel;
  
  // Parámetros adicionales específicos por canal
  filterStrength?: number;
  sensitivityFactor?: number;
  
  // Factores específicos por canal
  channelSpecific?: {
    [key: string]: any;
  };
}

// Configuración para optimizador de canal
export interface ChannelOptimizerConfig {
  // Canal a configurar
  channel: VitalSignChannel;
  
  // Parámetros de optimización
  parameters: Partial<OptimizationParameters>;
}

// Datos de retroalimentación desde calculador
export interface FeedbackData {
  // Canal al que aplica
  channel: VitalSignChannel;
  
  // Tipo de ajuste (aumento/disminución)
  adjustment: 'increase' | 'decrease' | 'reset' | 'fine-tune';
  
  // Magnitud del ajuste (0-1)
  magnitude: number;
  
  // Confianza del cálculo
  confidence?: number;
  
  // Parámetro específico a ajustar
  parameter?: keyof OptimizationParameters | string;
  
  // Datos adicionales específicos del canal
  additionalData?: any;
}

// Interfaz base para optimizador de canal
export interface ChannelOptimizer {
  // Devuelve el canal asociado
  getChannel(): VitalSignChannel;
  
  // Obtiene los parámetros actuales
  getParameters(): OptimizationParameters;
  
  // Establece parámetros
  setParameters(params: Partial<OptimizationParameters>): void;
  
  // Optimiza una señal para este canal
  optimize(signal: ProcessedPPGSignal): OptimizedSignal;
  
  // Procesa retroalimentación
  processFeedback(feedback: FeedbackData): void;
  
  // Reinicia el optimizador
  reset(): void;
}

// Interfaz para optimizador central
export interface SignalOptimizer {
  // Optimiza señal PPG para todos los canales
  optimizeSignal(signal: ProcessedPPGSignal): Record<VitalSignChannel, OptimizedSignal | null>;
  
  // Procesa retroalimentación
  processFeedback(feedback: FeedbackData): void;
  
  // Obtiene optimizador específico
  getOptimizer(channel: VitalSignChannel): ChannelOptimizer | null;
  
  // Configura canal específico
  setChannelConfig(config: ChannelOptimizerConfig): void;
  
  // Reinicia todos los optimizadores
  reset(): void;
}

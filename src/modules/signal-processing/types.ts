
/**
 * Tipos para el módulo de procesamiento de señal
 */

export interface ProcessedPPGSignal {
  // Valor raw original
  rawValue: number;
  
  // Valor filtrado
  filteredValue: number;
  
  // Marca de tiempo
  timestamp: number;
  
  // Calidad de señal (0-100)
  quality: number;
  
  // Detección de dedo
  fingerDetected: boolean;
  
  // Metadata de procesamiento
  isPeak?: boolean;
  lastPeakTime?: number | null;
  rrIntervals?: number[];
}

// Modos de procesamiento de señal
export type SignalProcessingMode = 'standard' | 'adaptive' | 'highSensitivity' | 'lowNoise';

// Opciones de configuración para procesador
export interface PPGProcessingOptions {
  // Umbral para detección de dedo
  fingerDetectionThreshold?: number;
  
  // Umbral para detección de picos
  peakDetectionThreshold?: number;
  
  // Tamaño de ventana para filtros
  filterWindowSize?: number;
  
  // Modo de procesamiento
  mode?: SignalProcessingMode;
  
  // Factor de amplificación
  amplificationFactor?: number;
}

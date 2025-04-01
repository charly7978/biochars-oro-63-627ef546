
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Tipos unificados para procesamiento de señales PPG
 */

/**
 * Señal PPG procesada por el procesador unificado
 */
export interface ProcessedPPGSignal {
  // Información temporal
  timestamp: number;
  
  // Valores de señal
  rawValue: number;
  filteredValue: number;
  amplifiedValue: number;
  normalizedValue: number;
  
  // Análisis de frecuencia cardíaca
  isPeak: boolean;
  peakConfidence: number;
  instantaneousBPM: number;
  rrInterval: number | null;
  heartRateVariability?: number;
  
  // Métricas de calidad
  quality: number;
  fingerDetected: boolean;
  signalStrength: number;
  
  // Estado de arritmia
  arrhythmiaCount: number;
}

/**
 * Error durante el procesamiento
 */
export interface ProcessingError {
  code: string;
  message: string;
  timestamp: number;
  name?: string;
}

/**
 * Opciones de configuración para el procesador unificado
 */
export interface UnifiedProcessorOptions {
  // Configuración de procesamiento
  bufferSize?: number;
  sampleRate?: number;
  
  // Umbrales y sensibilidad
  peakDetectionThreshold?: number;
  qualityThreshold?: number;
  
  // Amplificación y filtrado
  amplificationFactor?: number;
  useAdvancedFiltering?: boolean;
  filterStrength?: number;
  peakThreshold?: number;
  minPeakDistance?: number;
  fingerDetectionSensitivity?: number;
  
  // Callbacks
  onSignalReady?: (signal: ProcessedPPGSignal) => void;
  onError?: (error: Error) => void;
}

/**
 * Métricas de calidad de señal
 */
export interface SignalQualityMetrics {
  quality: number;
  strength: number;
  stability: number;
  noiseLevel: number;
}

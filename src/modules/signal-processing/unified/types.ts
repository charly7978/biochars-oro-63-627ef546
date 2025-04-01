
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Definiciones de tipos para el procesador unificado
 */

/**
 * Configuración para el procesador de señal unificado
 */
export interface SignalProcessorOptions {
  // Parámetros de filtrado y calidad
  amplificationFactor?: number;
  filterStrength?: number;
  qualityThreshold?: number;
  fingerDetectionSensitivity?: number;
  
  // Parámetros de detección de picos
  peakThreshold?: number;
  minPeakDistance?: number;
  
  // Callbacks
  onSignalReady?: (signal: ProcessedPPGSignal) => void;
  onError?: (error: Error) => void;
}

/**
 * Señal PPG procesada con datos completos
 */
export interface ProcessedPPGSignal {
  // Marca de tiempo
  timestamp: number;
  
  // Valores de señal
  rawValue: number;
  filteredValue: number;
  normalizedValue: number;
  amplifiedValue: number;
  
  // Calidad y detección
  quality: number;
  fingerDetected: boolean;
  signalStrength: number;
  
  // Datos de latidos
  isPeak: boolean;
  peakConfidence: number;
  instantaneousBPM: number | null;
  rrInterval: number | null;
  heartRateVariability: number | null;
  
  // Arritmias
  arrhythmiaCount: number;
}

/**
 * Métricas de calidad de señal
 */
export interface SignalQualityMetrics {
  quality: number;
  amplitude: number;
  signalStrength: number;
  weakSignalCount: number;
}

/**
 * Resultado de detección de dedo
 */
export interface FingerDetectionResult {
  detected: boolean;
  confidence: number;
  quality: number;
}

/**
 * Datos de intervalo RR
 */
export interface RRIntervalData {
  intervals: number[];
  lastPeakTime: number | null;
}

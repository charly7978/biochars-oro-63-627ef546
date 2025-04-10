import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';

/**
 * Representa una señal PPG procesada
 */
export interface ProcessedSignal {
  value: number[];
  filteredValue?: number[];
  quality: number;
  fingerDetected: boolean;
  timestamp: number;
  roi?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  perfusionIndex?: number;  // Índice de perfusión opcional
  spectrumData?: {          // Datos del espectro de frecuencia
    frequencies: number[];
    amplitudes: number[];
    dominantFrequency: number;
  };
  hydrationIndex?: number;  // Índice de hidratación
}

/**
 * Estructura de error de procesamiento
 */
export interface ProcessingError {
  code: string;       // Código de error
  message: string;    // Mensaje descriptivo
  timestamp: number;  // Marca de tiempo del error
}

/**
 * Interfaz que deben implementar todos los procesadores de señal
 */
export interface SignalProcessor {
  initialize: () => Promise<void>;                      // Inicialización
  start: () => void;                                    // Iniciar procesamiento
  stop: () => void;                                     // Detener procesamiento
  calibrate: () => Promise<boolean>;                    // Calibrar el procesador
  onSignalReady?: (signal: ProcessedSignal) => void;    // Callback de señal lista
  onError?: (error: ProcessingError) => void;           // Callback de error
}

/**
 * Extensión global para acceso al procesador de latidos
 */
declare global {
  interface Window {
    heartBeatProcessor: HeartBeatProcessor;
  }
}


/**
 * Definiciones de tipos para señales biométricas y procesamiento optimizado
 */

import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';

/**
 * Representa una señal PPG procesada
 */
export interface ProcessedSignal {
  // Valores principales
  timestamp: number;        // Marca de tiempo de la señal
  rawValue?: number;        // Valor crudo del sensor
  filteredValue: number;    // Valor filtrado para análisis
  quality: number;          // Calidad de la señal (0-100)
  fingerDetected: boolean;  // Si se detecta un dedo sobre el sensor
  
  // Información de ROI
  roi?: {                   // Región de interés en la imagen
    x: number;
    y: number;
    width: number;
    height: number;
  };
  
  // Análisis avanzado (opcional)
  perfusionIndex?: number;  // Índice de perfusión
  pressureArtifactLevel?: number; // Nivel de artefactos por presión
  normalizedSpectrum?: number[]; // Espectro normalizado para análisis
  
  // Datos multi-canal (opcional)
  channels?: {
    red: number;
    green: number;
    blue: number;
    infrared?: number;
  };
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
export interface ISignalProcessor {
  initialize: () => Promise<void>;                      // Inicialización
  start: () => void;                                    // Iniciar procesamiento
  stop: () => void;                                     // Detener procesamiento
  calibrate: () => Promise<boolean>;                    // Calibrar el procesador
  processFrame?: (imageData: ImageData) => void;        // Procesar frame de imagen
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

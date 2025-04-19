
/**
 * Definiciones de tipos para sistema de detección de dedos
 */

/**
 * Resultado detallado de la detección de dedos
 */
export interface FingerDetectionResult {
  isFingerDetected: boolean;
  confidence: number;
  timestamp: number;
  method: FingerDetectionMethod;
  roiRect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  metrics?: {
    colorScore?: number;
    patternScore?: number;
    mlScore?: number;
    textureScore?: number;
    motionScore?: number;
  };
}

/**
 * Método utilizado para la detección
 */
export type FingerDetectionMethod = 
  | 'color'
  | 'texture' 
  | 'pattern'
  | 'machine-learning'
  | 'optical-flow'
  | 'combined';

/**
 * Opciones para la configuración del detector
 */
export interface FingerDetectionOptions {
  /**
   * Umbral de confianza para la detección positiva
   */
  threshold?: number;
  
  /**
   * Cantidad de detecciones consecutivas necesarias para confirmar
   */
  consecutiveDetections?: number;
  
  /**
   * Tiempo mínimo (ms) entre detecciones para optimizar rendimiento
   */
  detectionInterval?: number;
  
  /**
   * Utilizar procesamiento optimizado
   */
  optimized?: boolean;
  
  /**
   * Métodos a utilizar para la detección
   */
  methods?: FingerDetectionMethod[];
  
  /**
   * Región de interés (proporción de la imagen completa)
   */
  roi?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}


/**
 * Definiciones de tipos para el procesamiento de señales
 */

// Datos de frame de cámara sin procesar
export interface RawSignalFrame {
  imageData: ImageData;
  timestamp: number;
  width: number;
  height: number;
}

// Datos de señal extraída
export interface ExtractedSignalData {
  value: number;
  timestamp: number;
  type: 'ppg' | 'heartbeat' | 'combined';
}

// Datos de PPG procesados
export interface ProcessedPPGData {
  timestamp: number;
  rawValue: number;
  filteredValue: number;
  fingerDetected: boolean;
  quality: number;
  roi?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Datos de latido cardíaco
export interface HeartBeatData {
  timestamp: number;
  rawValue: number;
  processedValue: number;
  bpm?: number;
  confidence?: number;
}

// Configuración de cámara
export interface CameraConfig {
  width: number;
  height: number;
  fps: number;
  facingMode: 'user' | 'environment';
}


/**
 * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
 * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
 * 
 * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
 * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
 * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
 */

/**
 * Definiciones de tipos para el sistema de procesamiento de señales
 */

export interface RGBData {
  red: number;
  green: number;
  blue: number;
}

export interface ChannelData {
  red: number;
  ir: number;
  ratio?: number;
}

export interface ROIData {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProcessedSignal {
  timestamp: number;
  rawValue: number;
  filteredValue: number;
  quality: number;
  fingerDetected: boolean;
  roi: ROIData;
  perfusionIndex: number;
}

export interface ProcessingError {
  code: string;
  message: string;
  timestamp: number;
}

export interface SignalProcessor {
  initialize(): Promise<void>;
  start(): void;
  stop(): void;
  calibrate(): Promise<boolean>;
  processFrame(imageData: ImageData): void;
}

export interface VitalSignsResult {
  timestamp: number;
  heartRate: number;
  spo2: number;
  pressure: string;
  bloodPressure?: {
    systolic: number;
    diastolic: number;
    display: string;
  };
  glucose?: number;
  lipids?: {
    totalCholesterol: number;
    triglycerides: number;
  };
  arrhythmiaStatus: string;
  arrhythmiaData?: {
    rmssd: number;
    rrVariation: number;
    detected: boolean;
    timestamp: number;
    windows?: any[][];
  };
  reliability: number;
}

// Agregamos las interfaces que faltaban para el sistema de cámara
export interface CameraConfig {
  width: number;
  height: number;
  fps: number;
  facingMode: 'user' | 'environment';
}

export interface RawSignalFrame {
  timestamp: number;
  imageData: ImageData;
  width: number;
  height: number;
  roi?: ROIData;
}

// Interfaces para extracción de señal
export interface PPGSignal {
  timestamp: number;
  value: number;
  quality: number;
}

export interface PPGSignalData {
  timestamp: number;
  rawValues: number[];
  filteredValue: number;
  quality: number;
}

export interface HeartBeatResult {
  timestamp: number;
  bpm: number; 
  peaks: number[];
  quality: number;
}

/**
 * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
 * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
 * 
 * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
 * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
 * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
 */

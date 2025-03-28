
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
    windows?: number[][];
  };
  reliability: number;
}

/**
 * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
 * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
 * 
 * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
 * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
 * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
 */

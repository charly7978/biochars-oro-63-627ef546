import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';

/**
 * Definición de frame de video para análisis PPG
 */
export interface Frame {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Resultado del análisis de un frame
 */
export interface FrameAnalysisResult {
  isFingerDetected: boolean;
  signalValue: number;
  signalQuality: number;
  timestamp: number;
  frameData: FrameData | null;
}

/**
 * Datos del frame procesados
 */
export interface FrameData {
  original: number[];
  processed: number[];
  decomposition: number[][];
  residue: number[];
}

/**
 * Configuración de regiones de interés
 */
export interface ROISettings {
  rows: number;
  cols: number;
  centerWeight: number;
  qualityThreshold: number;
  redDominanceMin: number;
}

/**
 * Representa una señal PPG procesada
 */
export interface ProcessedSignal {
  timestamp: number;        // Marca de tiempo de la señal
  rawValue: number;         // Valor crudo del sensor
  filteredValue: number;    // Valor filtrado para análisis
  quality: number;          // Calidad de la señal (0-100)
  fingerDetected: boolean;  // Si se detecta un dedo sobre el sensor
  roi: {                    // Región de interés en la imagen
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
  value?: number;           // Compatibilidad con código existente
  hydrationIndex?: number;  // Índice de hidratación
  windowValues?: number[];  // Ventana de valores para análisis
  minValue?: number;        // Valor mínimo de la señal
  maxValue?: number;        // Valor máximo de la señal
  channelData?: {           // Datos de múltiples canales
    red?: number;
    green?: number;
    blue?: number;
    ir?: number;
    redFiltered?: number;
    greenFiltered?: number;
    blueFiltered?: number;
    irFiltered?: number;
    redPower?: number;      // Potencia de la señal roja
    greenPower?: number;    // Potencia de la señal verde
    bluePower?: number;     // Potencia de la señal azul
    irPower?: number;       // Potencia de la señal infrarroja
    dominantChannel?: string; // Canal dominante (red, green, blue, ir)
  };
  decompositionData?: {     // Datos de descomposición de la señal
    imfs?: number[][];      // Funciones de modo intrínseco
    residue?: number[];     // Residuo de la descomposición
    selectedImf?: number;   // IMF seleccionada para análisis
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
export interface SignalProcessor {
  initialize: () => Promise<void>;                      // Inicialización
  start: () => void;                                    // Iniciar procesamiento
  stop: () => void;                                     // Detener procesamiento
  calibrate: () => Promise<boolean>;                    // Calibrar el procesador
  onSignalReady?: (signal: ProcessedSignal) => void;    // Callback de señal lista
  onError?: (error: ProcessingError) => void;           // Callback de error
}

/**
 * Opciones para configurar el procesamiento de señales
 */
export interface ProcessingOptions {
  windowSize?: number;       // Tamaño de la ventana para análisis
  samplingRate?: number;     // Frecuencia de muestreo en Hz
  filterSettings?: {
    lowCut?: number;         // Frecuencia de corte inferior
    highCut?: number;        // Frecuencia de corte superior
    order?: number;          // Orden del filtro
    filterType?: 'lowpass' | 'highpass' | 'bandpass' | 'notch';
  };
  roiSettings?: ROISettings;  // Configuración de regiones de interés
  emdOptions?: {
    maxIterations?: number;  // Número máximo de iteraciones
    threshold?: number;      // Umbral para detener iteraciones
    maxImf?: number;         // Número máximo de IMFs a calcular
  };
  enableEMD?: boolean;       // Habilitar descomposición EMD
  useGreenChannel?: boolean; // Usar canal verde para PPG
  useRedChannel?: boolean;   // Usar canal rojo para PPG
  adaptiveMode?: boolean;    // Modo adaptativo para ajustes automáticos
  fingerDetectionThreshold?: number; // Umbral para detección de dedo
}

/**
 * Interfaz para EMD (Empirical Mode Decomposition)
 */
export interface EMDProcessor {
  decompose(signal: number[]): {
    imfs: number[][];        // Funciones de modo intrínseco
    residue: number[];       // Residuo final
  };
  reconstruct(imfs: number[][], selectedIndices: number[]): number[];
  getInstantaneousFrequency(imf: number[]): number[];
  getEnergy(imf: number[]): number;
  isMonotonic(signal: number[]): boolean;
  findExtrema(signal: number[]): {
    maxima: { indices: number[], values: number[] };
    minima: { indices: number[], values: number[] };
  };
}

/**
 * Extensión global para acceso al procesador de latidos
 */
declare global {
  interface Window {
    heartBeatProcessor: HeartBeatProcessor;
  }
}

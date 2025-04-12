/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

// Importar tipos desde la ubicación central si es necesario globalmente
// import { ProcessedSignal, ProcessingError } from "@/core/types";

// Mantener extensiones de interfaces existentes si son necesarias
interface MediaTrackCapabilities {
  torch?: boolean;
  exposureMode?: ConstrainDOMString;
  focusMode?: ConstrainDOMString;
  whiteBalanceMode?: ConstrainDOMString;
  exposureCompensation?: ConstrainDouble;
  brightness?: ConstrainDouble;
  contrast?: ConstrainDouble;
  colorTemperature?: ConstrainDouble;
  iso?: ConstrainDouble;
  saturation?: ConstrainDouble;
  sharpness?: ConstrainDouble;
  zoom?: ConstrainDouble;
}

interface MediaTrackConstraintSet {
  torch?: ConstrainBoolean;
  exposureMode?: ConstrainDOMString;
  focusMode?: ConstrainDOMString;
  whiteBalanceMode?: ConstrainDOMString;
  exposureCompensation?: ConstrainDouble;
  brightness?: ConstrainDouble;
  contrast?: ConstrainDouble;
  colorTemperature?: ConstrainDouble;
  iso?: ConstrainDouble;
  saturation?: ConstrainDouble;
  sharpness?: ConstrainDouble;
  zoom?: ConstrainDouble;
  // Advanced Constraints: Usado para aplicar un conjunto de constraints no obligatorias
  advanced?: MediaTrackConstraintSet[];
}


declare class ImageCapture {
  constructor(track: MediaStreamTrack);
  grabFrame(): Promise<ImageBitmap>;
  takePhoto(photoSettings?: PhotoSettings): Promise<Blob>; // Añadir PhotoSettings si es necesario
  getPhotoCapabilities(): Promise<PhotoCapabilities>;
  getPhotoSettings(): Promise<PhotoSettings>;
  readonly track: MediaStreamTrack;
}

// Interfaces relacionadas con PhotoCapabilities y PhotoSettings si son necesarias
interface PhotoCapabilities {
    redEyeReduction: ReadonlyArray<string>; // "never", "always", "controllable"
    imageHeight: MediaSettingsRange;
    imageWidth: MediaSettingsRange;
    fillLightMode: ReadonlyArray<string>; // "auto", "off", "flash"
}

interface PhotoSettings {
    fillLightMode?: string; // "auto", "off", "flash"
    imageHeight?: number;
    imageWidth?: number;
    redEyeReduction?: boolean;
}

interface MediaSettingsRange {
    max: number;
    min: number;
    step: number;
}

// --- Definiciones que estaban aquí antes ---

/*
// @deprecated Use ProcessedSignal from '@/core/types'
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
}

// @deprecated Use ProcessingError from '@/core/types'
export interface ProcessingError {
  code: string;       // Código de error
  message: string;    // Mensaje descriptivo
  timestamp: number;  // Marca de tiempo del error
}
*/

/**
 * Interfaz genérica para un procesador de señal.
 * Podría definirse aquí si se necesita una interfaz global abstracta.
 */
export interface ISignalProcessor {
  initialize: () => Promise<void>;                      // Inicialización
  start: () => void;                                    // Iniciar procesamiento
  stop: () => void;                                     // Detener procesamiento
  calibrate?: () => Promise<boolean>;                    // Calibrar el procesador (opcional)
  // Usar tipos centrales para los callbacks
  onSignalReady?: (signal: import("@/core/types").ProcessedSignal) => void;    // Callback de señal lista
  onError?: (error: import("@/core/types").ProcessingError) => void;           // Callback de error
}

// Eliminar la extensión de Window si ya no se usa o se maneja de otra forma
// declare global {
//   interface Window {
//     heartBeatProcessor?: import("@/modules/HeartBeatProcessor").HeartBeatProcessor; // Ejemplo si se adjuntaba a window
//   }
// }

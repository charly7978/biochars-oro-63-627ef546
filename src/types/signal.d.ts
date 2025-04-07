
/**
 * Tipos para procesamiento de señales PPG y módulos relacionados
 */

export interface ProcessedSignal {
  timestamp: number;
  rawValue: number;
  filteredValue: number;
  quality: number;
  fingerDetected: boolean;
  roi: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  perfusionIndex: number;
  spectrumData?: {
    frequencies: number[];
    amplitudes: number[];
    dominantFrequency: number;
  };
  // Nuevos campos para procesamiento avanzado
  channelData?: {
    red: number;
    green: number;
    blue: number;
    composite: number;
  };
  movementData?: {
    detected: boolean;
    intensity: number;
    isReliable: boolean;
  };
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
  calibrate?(): Promise<boolean>;
  processFrame(imageData: ImageData): void;
  onSignalReady?: (signal: ProcessedSignal) => void;
  onError?: (error: ProcessingError) => void;
}

export interface FilterConfiguration {
  type: 'kalman' | 'wavelet' | 'bandpass' | 'adaptive';
  parameters: Record<string, number>;
}

export interface ROIConfiguration {
  useAdaptiveROI: boolean;
  updateInterval: number;
  minSize: number;
  maxSize: number;
}

// Nuevos tipos para procesamiento multicanal
export interface ChannelData {
  red: number[];
  green: number[];
  blue: number[];
  composite: number[];
}

export interface ChannelQuality {
  red: number;
  green: number;
  blue: number;
  composite: number;
}

// Tipos para detección de movimiento
export interface MovementData {
  detected: boolean;
  intensity: number;
  acceleration?: number[];
  reliability: number;
}

// Tipo para separación ciega de fuentes (BSS)
export interface BSSResult {
  sources: number[][];
  mixingMatrix: number[][];
  unmixingMatrix: number[][];
  dominantSource: number;
}

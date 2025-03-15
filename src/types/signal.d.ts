// Extensión de la definición existente para añadir métricas avanzadas

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
  perfusionIndex?: number;
  // Nuevas métricas avanzadas
  spectralPower?: number;    // Potencia espectral total (análisis de espectro)
  pulseAmplitude?: number;   // Amplitud de pulso 
  signalSnr?: number;        // Relación señal-ruido (calidad)
  metabolicEstimates?: {     // Nuevas estimaciones metabólicas
    glucose?: number;        // Nivel de glucosa estimado (mg/dL)
    cholesterol?: number;    // Colesterol total estimado (mg/dL)
    triglycerides?: number;  // Triglicéridos estimados (mg/dL)
  }
}

export interface ProcessingError {
  code: string;
  message: string;
  timestamp: number;
}

export interface SignalProcessor {
  onSignalReady?: (signal: ProcessedSignal) => void;
  onError?: (error: ProcessingError) => void;
  initialize(): Promise<void>;
  start(): void;
  stop(): void;
  calibrate(): Promise<boolean>;
  processFrame(imageData: ImageData): void;
}

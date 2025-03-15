
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
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
  physicalSignatureScore: number;
  rgbValues: {
    red: number;
    green: number;
    blue: number;
  };
  panTompkinsMetrics?: {
    isPeak: boolean;
    threshold: number;
    accuracy: number;
    signalStrength: number;
  };
}


/**
 * Extractor combinado de señales
 * Integra los extractores específicos y proporciona una salida unificada
 */

import { HeartbeatExtractor } from './HeartbeatExtractor';
import { PPGSignalExtractor } from './PPGSignalExtractor';

export interface CombinedExtractionResult {
  // Salida del extractor de latidos
  heartbeat: {
    isPeak: boolean;
    timestamp: number;
    rawPeakValue: number;
    intervals: number[];
    lastPeakTime: number | null;
  };
  
  // Salida del extractor de señal PPG
  ppg: {
    rawValue: number;
    timestamp: number;
    signalStrength: number;
    fingerDetected: boolean;
  };
  
  // Salida balanceada (combinación de ambos)
  combined: {
    value: number;
    isPeak: boolean;
    signalStrength: number;
    fingerDetected: boolean;
    timestamp: number;
    rrIntervals: number[];
  };
}

export class CombinedExtractor {
  private heartbeatExtractor: HeartbeatExtractor;
  private ppgExtractor: PPGSignalExtractor;
  
  constructor() {
    this.heartbeatExtractor = new HeartbeatExtractor();
    this.ppgExtractor = new PPGSignalExtractor();
    
    console.log("CombinedExtractor: Inicializado con extractores específicos");
  }
  
  /**
   * Extrae información combinada de la señal
   * Proporciona tres salidas: heartbeat, ppg y combined
   */
  public extract(value: number): CombinedExtractionResult {
    // Extraer información de latidos
    const heartbeatResult = this.heartbeatExtractor.extract(value);
    
    // Extraer información de señal PPG
    const ppgResult = this.ppgExtractor.extract(value);
    
    // Crear salida combinada
    const combinedResult = {
      value,
      isPeak: heartbeatResult.isPeak,
      signalStrength: ppgResult.signalStrength,
      fingerDetected: ppgResult.fingerDetected,
      timestamp: Date.now(),
      rrIntervals: heartbeatResult.intervals
    };
    
    return {
      heartbeat: heartbeatResult,
      ppg: ppgResult,
      combined: combinedResult
    };
  }
  
  /**
   * Reinicia los extractores
   */
  public reset(): void {
    this.heartbeatExtractor.reset();
    this.ppgExtractor.reset();
  }
  
  /**
   * Configura parámetros de los extractores
   */
  public configure(config: {
    heartbeat?: {
      peakThreshold?: number;
      minPeakDistance?: number;
      maxIntervals?: number;
    };
    ppg?: {
      minSignalThreshold?: number;
      stableCountThreshold?: number;
      maxRecentValues?: number;
    };
  }): void {
    if (config.heartbeat) {
      this.heartbeatExtractor.configure(config.heartbeat);
    }
    
    if (config.ppg) {
      this.ppgExtractor.configure(config.ppg);
    }
  }
}

/**
 * Crea una nueva instancia del extractor combinado
 */
export function createCombinedExtractor(): CombinedExtractor {
  return new CombinedExtractor();
}

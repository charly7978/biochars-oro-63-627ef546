
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

  // Metadatos adicionales para integración
  quality?: number;
  averageBPM?: number;
  confidence?: number;
}

export class CombinedExtractor {
  private heartbeatExtractor: HeartbeatExtractor;
  private ppgExtractor: PPGSignalExtractor;
  private lastResult: CombinedExtractionResult | null = null;
  private avgBPMBuffer: number[] = [];
  private readonly MAX_BPM_BUFFER = 10;
  
  constructor() {
    this.heartbeatExtractor = new HeartbeatExtractor();
    this.ppgExtractor = new PPGSignalExtractor();
    
    console.log("CombinedExtractor: Inicializado con extractores específicos");
  }
  
  /**
   * Procesa un valor único PPG y extrae información combinada
   * Método principal de entrada para la extracción de datos
   */
  public processValue(value: number): CombinedExtractionResult {
    return this.extract(value);
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
    
    // Calcular BPM promedio si hay suficientes intervalos
    let avgBPM = 0;
    let confidence = 0;
    
    if (heartbeatResult.intervals.length > 2) {
      // Calcular BPM basado en intervalos
      const validIntervals = heartbeatResult.intervals.filter(i => i > 300 && i < 2000);
      
      if (validIntervals.length > 0) {
        const avgInterval = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
        avgBPM = Math.round(60000 / avgInterval);
        
        // Calcular confianza basada en estabilidad de intervalos
        const stdDev = Math.sqrt(
          validIntervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / validIntervals.length
        );
        
        // Menor desviación = mayor confianza
        confidence = Math.max(0, Math.min(1, 1 - (stdDev / avgInterval / 0.5)));
        
        // Actualizar buffer de BPM para estabilidad
        this.avgBPMBuffer.push(avgBPM);
        if (this.avgBPMBuffer.length > this.MAX_BPM_BUFFER) {
          this.avgBPMBuffer.shift();
        }
        
        // Suavizar BPM con promedio móvil
        if (this.avgBPMBuffer.length > 1) {
          avgBPM = Math.round(
            this.avgBPMBuffer.reduce((a, b) => a + b, 0) / this.avgBPMBuffer.length
          );
        }
      }
    }
    
    // Calcular calidad de señal
    const signalQuality = ppgResult.signalStrength * (heartbeatResult.intervals.length > 3 ? 1 : 0.5);
    
    // Crear salida combinada
    const combinedResult = {
      value,
      isPeak: heartbeatResult.isPeak,
      signalStrength: ppgResult.signalStrength,
      fingerDetected: ppgResult.fingerDetected,
      timestamp: Date.now(),
      rrIntervals: heartbeatResult.intervals
    };
    
    // Resultado final
    const result: CombinedExtractionResult = {
      heartbeat: heartbeatResult,
      ppg: ppgResult,
      combined: combinedResult,
      quality: signalQuality,
      averageBPM: avgBPM > 30 && avgBPM < 220 ? avgBPM : null,
      confidence
    };
    
    this.lastResult = result;
    return result;
  }
  
  /**
   * Reinicia los extractores
   */
  public reset(): void {
    this.heartbeatExtractor.reset();
    this.ppgExtractor.reset();
    this.lastResult = null;
    this.avgBPMBuffer = [];
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
  
  /**
   * Obtiene el último resultado procesado
   */
  public getLastResult(): CombinedExtractionResult | null {
    return this.lastResult;
  }
}

/**
 * Crea una nueva instancia del extractor combinado
 */
export function createCombinedExtractor(): CombinedExtractor {
  return new CombinedExtractor();
}

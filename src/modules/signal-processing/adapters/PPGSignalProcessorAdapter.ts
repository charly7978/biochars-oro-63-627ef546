
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Adaptador para mantener compatibilidad con PPGSignalProcessor
 */

import { UnifiedSignalProcessor } from '../unified/UnifiedSignalProcessor';
import { ProcessedPPGSignal, SignalProcessingOptions } from '../types';

/**
 * Adaptador que permite usar el procesador unificado manteniendo
 * la interfaz del PPGSignalProcessor original
 */
export class PPGSignalProcessorAdapter {
  private unifiedProcessor: UnifiedSignalProcessor;
  
  constructor() {
    this.unifiedProcessor = new UnifiedSignalProcessor();
  }
  
  /**
   * Procesa una señal PPG y devuelve un resultado compatible
   * con el formato original
   */
  public processSignal(value: number): ProcessedPPGSignal {
    // Procesar con el nuevo procesador unificado
    const result = this.unifiedProcessor.processSignal(value);
    
    // Adaptar al formato anterior
    return {
      timestamp: result.timestamp,
      rawValue: result.rawValue,
      filteredValue: result.filteredValue,
      normalizedValue: result.normalizedValue,
      amplifiedValue: result.amplifiedValue,
      quality: result.quality,
      fingerDetected: result.fingerDetected,
      signalStrength: result.signalStrength,
      isPeak: result.isPeak,
      instantaneousBPM: result.instantaneousBPM,
      rrInterval: result.rrInterval,
      peakConfidence: result.peakConfidence,
      arrhythmiaCount: result.arrhythmiaCount,
      heartRateVariability: result.heartRateVariability
    };
  }
  
  /**
   * Configura el procesador
   */
  public configure(options: SignalProcessingOptions): void {
    this.unifiedProcessor.configure({
      amplificationFactor: options.amplificationFactor,
      qualityThreshold: options.qualityThreshold,
      fingerDetectionSensitivity: options.fingerDetectionSensitivity,
      peakDetectionThreshold: options.amplificationFactor ? options.amplificationFactor / 3 : undefined
    });
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    this.unifiedProcessor.reset();
  }
}

/**
 * Crea una nueva instancia del adaptador
 */
export function createPPGSignalProcessorAdapter(): PPGSignalProcessorAdapter {
  return new PPGSignalProcessorAdapter();
}

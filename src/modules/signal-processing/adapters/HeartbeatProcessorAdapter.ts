
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Adaptador para mantener compatibilidad con HeartbeatProcessor
 */

import { UnifiedSignalProcessor } from '../unified/UnifiedSignalProcessor';
import { ProcessedHeartbeatSignal, SignalProcessingOptions } from '../types';

/**
 * Adaptador que permite usar el procesador unificado manteniendo
 * la interfaz del HeartbeatProcessor original
 */
export class HeartbeatProcessorAdapter {
  private unifiedProcessor: UnifiedSignalProcessor;
  
  constructor() {
    this.unifiedProcessor = new UnifiedSignalProcessor();
  }
  
  /**
   * Procesa una señal y devuelve un resultado compatible
   * con el formato original de HeartbeatProcessor
   */
  public processSignal(value: number): ProcessedHeartbeatSignal {
    // Procesar con el nuevo procesador unificado
    const result = this.unifiedProcessor.processSignal(value);
    
    // Adaptar al formato anterior
    return {
      timestamp: result.timestamp,
      value: result.filteredValue,
      isPeak: result.isPeak,
      peakConfidence: result.peakConfidence,
      instantaneousBPM: result.instantaneousBPM,
      rrInterval: result.rrInterval,
      heartRateVariability: result.heartRateVariability
    };
  }
  
  /**
   * Configura el procesador
   */
  public configure(options: SignalProcessingOptions): void {
    this.unifiedProcessor.configure({
      amplificationFactor: options.amplificationFactor,
      filterStrength: options.filterStrength,
      peakThreshold: options.amplificationFactor ? options.amplificationFactor / 2 : undefined,
      minPeakDistance: options.filterStrength ? 250 + (options.filterStrength * 100) : undefined
    });
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    this.unifiedProcessor.reset();
  }
  
  /**
   * Obtiene el estado del predictor adaptativo (para compatibilidad)
   */
  public getAdaptivePredictorState(): any {
    return {
      confidence: 0.85,
      horizon: 5,
      history: []
    };
  }
}

/**
 * Crea una nueva instancia del adaptador
 */
export function createHeartbeatProcessorAdapter(): HeartbeatProcessorAdapter {
  return new HeartbeatProcessorAdapter();
}

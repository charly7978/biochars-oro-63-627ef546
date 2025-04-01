
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
    console.log("PPGSignalProcessorAdapter: Adaptador creado con umbrales mejorados");
    
    // Configuración inicial con umbrales más estrictos
    this.configure({
      amplificationFactor: 1.5, // Mayor amplificación
      qualityThreshold: 50,     // Umbral de calidad más alto
      fingerDetectionSensitivity: 0.8, // Mayor sensibilidad para dedo
      peakDetectionThreshold: 0.3      // Mayor umbral para picos
    });
  }
  
  /**
   * Procesa una señal PPG y devuelve un resultado compatible
   * con el formato original
   */
  public processSignal(value: number): ProcessedPPGSignal {
    // Procesar con el nuevo procesador unificado
    const result = this.unifiedProcessor.processSignal(value);
    
    // Validar la señal - más estricto
    if (Math.abs(value) < 0.2) {
      console.log("PPGSignalProcessorAdapter: Señal muy débil detectada", {
        valor: value,
        umbralMínimo: 0.2,
        esDemasiadoDébil: true
      });
    }
    
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
   * Configura el procesador con umbrales más estrictos por defecto
   */
  public configure(options: SignalProcessingOptions): void {
    // Aplicar configuración con valores mejorados por defecto
    this.unifiedProcessor.configure({
      amplificationFactor: options.amplificationFactor || 1.5,
      qualityThreshold: options.qualityThreshold || 50,
      fingerDetectionSensitivity: options.fingerDetectionSensitivity || 0.8,
      peakDetectionThreshold: options.peakDetectionThreshold || 0.3,
      // Usar un valor específico para minPeakDistance
      minPeakDistance: 300, // 300ms mínimo entre picos (no permitir frecuencias irrealmente altas)
      // Otras opciones
      bufferSize: options.bufferSize,
      sampleRate: options.sampleRate,
      filterStrength: options.filterStrength,
      onSignalReady: options.onSignalReady,
      onError: options.onError
    });
    
    console.log("PPGSignalProcessorAdapter: Procesador configurado con umbrales mejorados");
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    this.unifiedProcessor.reset();
    console.log("PPGSignalProcessorAdapter: Procesador reiniciado");
  }
}

/**
 * Crea una nueva instancia del adaptador
 */
export function createPPGSignalProcessorAdapter(): PPGSignalProcessorAdapter {
  return new PPGSignalProcessorAdapter();
}

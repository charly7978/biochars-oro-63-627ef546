
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
    
    // Configuración inicial con umbrales más sensibles para señales débiles
    this.configure({
      amplificationFactor: 2.0,         // Mucho mayor amplificación
      qualityThreshold: 30,             // Umbral de calidad más permisivo
      fingerDetectionSensitivity: 0.5,  // Mayor sensibilidad para dedo
      peakDetectionThreshold: 0.12      // Umbral más bajo para detectar picos
    });
  }
  
  /**
   * Procesa una señal PPG y devuelve un resultado compatible
   * con el formato original. Ahora con diagnóstico mejorado
   */
  public processSignal(value: number): ProcessedPPGSignal {
    // Procesar con el nuevo procesador unificado
    const result = this.unifiedProcessor.processSignal(value);
    
    // Validar la señal - más sensible
    if (Math.abs(value) < 0.05) {
      console.log("PPGSignalProcessorAdapter: Señal muy débil detectada", {
        valor: value,
        umbralMínimo: 0.05,
        esDemasiadoDébil: true
      });
    }
    
    // Diagnóstico de picos
    if (result.isPeak) {
      console.log("PPGSignalProcessorAdapter: PICO DETECTADO", {
        confianza: result.peakConfidence,
        bpmInstantáneo: result.instantaneousBPM,
        calidad: result.quality
      });
    } else if (result.fingerDetected && result.quality > 30) {
      // Si hay dedo pero no detecta picos, puede ser señal anémica
      console.log("PPGSignalProcessorAdapter: Dedo detectado PERO NO HAY PICOS", {
        calidad: result.quality,
        fuerzaSeñal: result.signalStrength,
        valorFiltrado: result.filteredValue,
        valorAmplificado: result.amplifiedValue
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
   * Configura el procesador con umbrales más sensibles por defecto
   */
  public configure(options: SignalProcessingOptions): void {
    // Aplicar configuración con valores más sensibles por defecto
    this.unifiedProcessor.configure({
      amplificationFactor: options.amplificationFactor || 2.0,
      qualityThreshold: options.qualityThreshold || 30,
      fingerDetectionSensitivity: options.fingerDetectionSensitivity || 0.5,
      peakDetectionThreshold: options.peakDetectionThreshold || 0.12,
      // Usar un valor específico para minPeakDistance
      minPeakDistance: 250, // 250ms mínimo entre picos (permite frecuencias más altas)
      // Otras opciones
      bufferSize: options.bufferSize,
      sampleRate: options.sampleRate,
      filterStrength: options.filterStrength || 0.4, // Mayor fortaleza de filtro
      onSignalReady: options.onSignalReady,
      onError: options.onError
    });
    
    console.log("PPGSignalProcessorAdapter: Procesador configurado con umbrales más sensibles");
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

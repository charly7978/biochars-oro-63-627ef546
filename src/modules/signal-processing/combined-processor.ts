
/**
 * Procesador combinado de señales PPG y latidos
 * Integra procesamiento y optimización
 */

import { SignalProcessor, ProcessedPPGSignal } from './types';
import { PPGProcessor } from './ppg-processor';
import { HeartbeatProcessor } from './heartbeat-processor';

/**
 * Procesador que integra varios tipos de señales
 */
export class CombinedProcessor implements SignalProcessor {
  private ppgProcessor: PPGProcessor;
  private heartbeatProcessor: HeartbeatProcessor;
  private initialized = false;
  private signalStrength = 0;
  private fingerDetected = false;
  
  constructor() {
    this.ppgProcessor = new PPGProcessor();
    this.heartbeatProcessor = new HeartbeatProcessor();
    
    this.reset();
  }
  
  /**
   * Inicializa el procesador combinado
   */
  public initialize(): void {
    console.log("CombinedProcessor: Inicializando procesadores");
    
    // Inicializar procesadores internos
    this.ppgProcessor.initialize();
    this.heartbeatProcessor.initialize();
    
    // Configurar detector de latidos
    this.heartbeatProcessor.configure({
      threshold: 0.2,
      bufferSize: 100
    });
    
    this.initialized = true;
  }
  
  /**
   * Procesa un valor crudo y produce resultados de ambos procesadores
   */
  public processSignal(input: number): ProcessedPPGSignal {
    // Verificar inicialización
    if (!this.initialized) {
      this.initialize();
    }
    
    try {
      // Etapa 1: Procesar PPG
      const ppgSignal = this.ppgProcessor.processSignal(input);
      
      // Actualizar estado
      this.signalStrength = ppgSignal.signalStrength;
      this.fingerDetected = ppgSignal.fingerDetected;
      
      // Si no hay dedo o señal muy débil, devolver solo resultado PPG
      if (!ppgSignal.fingerDetected || ppgSignal.quality < 20) {
        return ppgSignal;
      }
      
      // Etapa 2: Procesar latidos con señal PPG
      const combinedSignal = this.heartbeatProcessor.processProcessedSignal(ppgSignal);
      
      // Añadir metadatos
      this.addMetadata(combinedSignal);
      
      return combinedSignal;
    } catch (error) {
      console.error("Error en CombinedProcessor:", error);
      
      // Devolver señal básica en caso de error
      return {
        timestamp: Date.now(),
        rawValue: input,
        normalizedValue: input,
        amplifiedValue: input,
        filteredValue: input,
        quality: 0,
        fingerDetected: false,
        signalStrength: 0,
        isPeak: false
      };
    }
  }
  
  /**
   * Iniciar procesamiento
   */
  public start(): void {
    this.ppgProcessor.start();
    this.heartbeatProcessor.start();
    this.initialized = true;
  }
  
  /**
   * Detener procesamiento
   */
  public stop(): void {
    this.ppgProcessor.stop();
    this.heartbeatProcessor.stop();
    this.initialized = false;
  }
  
  /**
   * Resetear procesadores
   */
  public reset(): void {
    this.ppgProcessor.reset();
    this.heartbeatProcessor.reset();
    this.initialized = false;
    this.signalStrength = 0;
    this.fingerDetected = false;
  }
  
  /**
   * Calibra el procesador con datos de referencia
   */
  public calibrate(referenceValues: number[]): void {
    if (referenceValues && referenceValues.length > 5) {
      this.ppgProcessor.calibrate(referenceValues);
    }
  }
  
  /**
   * Añade metadatos adicionales a la señal procesada
   */
  private addMetadata(signal: ProcessedPPGSignal): void {
    signal.metadata = {
      ...signal.metadata,
      processorVersion: '2.0',
      signalType: 'combined',
      processingTimeMs: Date.now() - signal.timestamp
    };
  }
}

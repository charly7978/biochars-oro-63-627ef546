
/**
 * Procesador combinado de señales
 * Integra procesamiento PPG y cardíaco en un único flujo de trabajo
 */

import { PPGProcessor } from './ppg-processor';
import { HeartbeatProcessor } from './heartbeat-processor';
import { ProcessedPPGSignal, PPGProcessingOptions } from './types';

export class CombinedSignalProcessor {
  private ppgProcessor: PPGProcessor;
  private heartbeatProcessor: HeartbeatProcessor;
  private lastProcessedSignal: ProcessedPPGSignal | null = null;
  
  constructor(options: PPGProcessingOptions = {}) {
    this.ppgProcessor = new PPGProcessor(options);
    this.heartbeatProcessor = new HeartbeatProcessor(options);
    
    console.log("CombinedSignalProcessor: Inicializado con procesadores específicos");
  }
  
  /**
   * Procesa un valor único y obtiene señal procesada completa
   */
  public processValue(value: number): ProcessedPPGSignal {
    // Primero procesamos la señal PPG
    const ppgResult = this.ppgProcessor.processValue(value);
    
    // Solo procesamos los latidos si hay dedo detectado
    if (ppgResult.fingerDetected && ppgResult.quality > 30) {
      // Procesamos la señal para obtener información de latidos
      const heartbeatResult = this.heartbeatProcessor.processSignal(ppgResult.filteredValue);
      
      // Integramos la información de latidos en el resultado PPG
      ppgResult.isPeak = heartbeatResult.isPeak;
      ppgResult.lastPeakTime = heartbeatResult.lastPeakTime;
      ppgResult.rrIntervals = heartbeatResult.rrIntervals;
    }
    
    this.lastProcessedSignal = ppgResult;
    return ppgResult;
  }
  
  /**
   * Reinicia todos los procesadores
   */
  public reset(): void {
    this.ppgProcessor.reset();
    this.heartbeatProcessor.reset();
    this.lastProcessedSignal = null;
  }
  
  /**
   * Configura parámetros de los procesadores
   */
  public configure(options: PPGProcessingOptions): void {
    this.ppgProcessor.configure(options);
    // Configurar el procesador de latidos con los mismos parámetros
    if (options.peakDetectionThreshold) {
      this.heartbeatProcessor.configure(options);
    }
  }
  
  /**
   * Obtiene el último resultado procesado
   */
  public getLastResult(): ProcessedPPGSignal | null {
    return this.lastProcessedSignal;
  }
}

/**
 * Procesador combinado de señal PPG y latidos cardíacos
 */

import { SignalProcessor, SignalProcessorConfig } from './types';
import { PPGProcessor } from './ppg-processor';
import { HeartbeatProcessor } from './heartbeat-processor';
import { ProcessedPPGSignal } from './types';

/**
 * Procesador que integra el procesamiento de PPG y latidos cardíacos
 */
export class CombinedProcessor implements SignalProcessor {
  private ppgProcessor: PPGProcessor;
  private heartbeatProcessor: HeartbeatProcessor;
  private lastRawValue: number = 0;
  private isInitialized: boolean = false;
  private config: SignalProcessorConfig = {
    mode: 'standard',
    filterWindowSize: 10,
    amplificationFactor: 1.5
  };
  
  /**
   * Crea un nuevo procesador combinado
   */
  constructor() {
    this.ppgProcessor = new PPGProcessor();
    this.heartbeatProcessor = new HeartbeatProcessor();
  }
  
  /**
   * Inicializa el procesador combinado
   */
  public async initialize(): Promise<void> {
    try {
      // Inicializar procesadores
      this.ppgProcessor.initialize();
      await this.heartbeatProcessor.initialize();
      
      // Aplicar configuración inicial
      this.ppgProcessor.configure(this.config);
      
      // Configurar heartbeatProcessor (si tiene método de configuración)
      if ('configure' in this.heartbeatProcessor) {
        (this.heartbeatProcessor as any).configure(this.config);
      }
      
      this.isInitialized = true;
      console.log("CombinedProcessor: Inicializado correctamente");
    } catch (error) {
      console.error("Error inicializando CombinedProcessor:", error);
      throw error;
    }
  }
  
  /**
   * Configura el procesador combinado
   */
  public configure(config: Partial<SignalProcessorConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Aplicar a ambos procesadores si están disponibles
    if (this.ppgProcessor) {
      this.ppgProcessor.configure(this.config);
    }
    
    // Configurar heartbeatProcessor (si tiene método de configuración)
    if (this.heartbeatProcessor && 'configure' in this.heartbeatProcessor) {
      (this.heartbeatProcessor as any).configure(this.config);
    }
  }
  
  /**
   * Procesa una señal PPG
   */
  public processSignal(input: number): ProcessedPPGSignal {
    if (!this.isInitialized) {
      console.warn("CombinedProcessor: No inicializado, devolviendo señal por defecto");
      return {
        rawValue: input,
        filteredValue: input,
        timestamp: Date.now(),
        quality: 0,
        fingerDetected: false
      };
    }
    
    // Procesar con PPGProcessor
    const ppgSignal = this.ppgProcessor.processSignal(input);
    
    // Procesar con HeartbeatProcessor
    const enrichedSignal = this.heartbeatProcessor.processSignal(ppgSignal);
    
    this.lastRawValue = input;
    return enrichedSignal;
  }
  
  /**
   * Reinicia ambos procesadores
   */
  public reset(): void {
    this.ppgProcessor.reset();
    this.heartbeatProcessor.reset();
    this.isInitialized = false;
    console.log("CombinedProcessor: Reiniciado");
  }
  
  /**
   * Inicia el procesamiento
   */
  public start(): void {
    this.ppgProcessor.start();
    this.heartbeatProcessor.start();
    console.log("CombinedProcessor: Iniciado");
  }
  
  /**
   * Detiene el procesamiento
   */
  public stop(): void {
    this.ppgProcessor.stop();
    this.heartbeatProcessor.stop();
    console.log("CombinedProcessor: Detenido");
  }
  
  /**
   * Calibra ambos procesadores
   */
  public async calibrate(): Promise<boolean> {
    try {
      const ppgCalibrated = await this.ppgProcessor.calibrate();
      const heartBeatCalibrated = await this.heartbeatProcessor.calibrate();
      
      return ppgCalibrated && heartBeatCalibrated;
    } catch (error) {
      console.error("Error durante la calibración:", error);
      return false;
    }
  }
}

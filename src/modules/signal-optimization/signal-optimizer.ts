
/**
 * Optimizador central de señales
 * Gestiona todos los canales de optimización y coordina el procesamiento
 */

import { ProcessedPPGSignal } from '../signal-processing/types';
import { HeartRateOptimizer } from './channels/heart-rate-optimizer';
import { SPO2Optimizer } from './channels/spo2-optimizer';
import { BloodPressureOptimizer } from './channels/blood-pressure-optimizer';
import { GlucoseOptimizer } from './channels/glucose-optimizer';
import { CholesterolOptimizer } from './channels/cholesterol-optimizer';
import { TriglyceridesOptimizer } from './channels/triglycerides-optimizer';
import { 
  SignalOptimizer,
  ChannelOptimizer,
  VitalSignChannel,
  OptimizedSignal,
  FeedbackData,
  ChannelOptimizerConfig
} from './types';

/**
 * Optimizador central que distribuye la señal a optimizadores especializados
 * y coordina feedback bidireccional desde los calculadores
 */
export class CentralSignalOptimizer implements SignalOptimizer {
  // Optimizadores especializados por canal
  private optimizers: Map<VitalSignChannel, ChannelOptimizer> = new Map();
  
  /**
   * Inicializa optimizadores para todos los canales
   */
  constructor() {
    this.initializeOptimizers();
    console.log("SignalOptimizer: Inicializado con 6 canales especializados y sistemas adaptativos avanzados");
  }
  
  /**
   * Crea optimizadores específicos para cada canal
   */
  private initializeOptimizers(): void {
    // Crear optimizadores especializados
    this.optimizers.set('heartRate', new HeartRateOptimizer());
    this.optimizers.set('spo2', new SPO2Optimizer());
    this.optimizers.set('bloodPressure', new BloodPressureOptimizer());
    this.optimizers.set('glucose', new GlucoseOptimizer());
    this.optimizers.set('cholesterol', new CholesterolOptimizer());
    this.optimizers.set('triglycerides', new TriglyceridesOptimizer());
  }
  
  /**
   * Optimiza la señal PPG para todos los canales
   */
  public optimizeSignal(signal: ProcessedPPGSignal): Record<VitalSignChannel, OptimizedSignal> {
    const results: Record<VitalSignChannel, OptimizedSignal> = {} as Record<VitalSignChannel, OptimizedSignal>;
    
    // Procesar cada canal independientemente
    this.optimizers.forEach((optimizer, channel) => {
      // Optimizar señal para canal específico
      results[channel] = optimizer.optimize(signal);
    });
    
    return results;
  }
  
  /**
   * Procesa feedback desde sistema de cálculo
   * Implementa comunicación bidireccional entre optimizador y calculador
   */
  public processFeedback(feedback: FeedbackData): void {
    // Obtener optimizador correspondiente al canal
    const optimizer = this.optimizers.get(feedback.channel);
    if (!optimizer) return;
    
    // Enviar feedback al optimizador específico
    optimizer.processFeedback(feedback);
  }
  
  /**
   * Obtiene optimizador específico por canal
   */
  public getOptimizer(channel: VitalSignChannel): ChannelOptimizer | null {
    return this.optimizers.get(channel) || null;
  }
  
  /**
   * Configura un canal específico
   */
  public setChannelConfig(config: ChannelOptimizerConfig): void {
    const optimizer = this.optimizers.get(config.channel);
    if (!optimizer) return;
    
    optimizer.setParameters(config.parameters);
  }
  
  /**
   * Reinicia todos los optimizadores
   */
  public reset(): void {
    this.optimizers.forEach(optimizer => optimizer.reset());
  }
}

/**
 * Crea una nueva instancia del optimizador de señal
 */
export function createSignalOptimizer(): SignalOptimizer {
  return new CentralSignalOptimizer();
}

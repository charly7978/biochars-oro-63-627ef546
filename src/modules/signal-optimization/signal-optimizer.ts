
/**
 * Optimizador central de señal
 * Gestiona los canales especializados para cada signo vital
 */

import { ProcessedPPGSignal } from '../signal-processing/types';
import { 
  SignalOptimizer, 
  VitalSignChannel, 
  OptimizedSignal, 
  FeedbackData, 
  ChannelOptimizer,
  ChannelOptimizerConfig
} from './types';

import { HeartRateOptimizer } from './channels/heart-rate-optimizer';
import { SPO2Optimizer } from './channels/spo2-optimizer';
import { BloodPressureOptimizer } from './channels/blood-pressure-optimizer';
import { GlucoseOptimizer } from './channels/glucose-optimizer';
import { CholesterolOptimizer } from './channels/cholesterol-optimizer';
import { TriglyceridesOptimizer } from './channels/triglycerides-optimizer';

/**
 * Implementación del optimizador central de señal
 * Divide la señal en canales especializados para cada signo vital
 */
export class SignalOptimizerImpl implements SignalOptimizer {
  private optimizers: Map<VitalSignChannel, ChannelOptimizer> = new Map();
  private lastOptimized: Record<VitalSignChannel, OptimizedSignal | null> = {
    heartRate: null,
    spo2: null,
    bloodPressure: null,
    glucose: null,
    cholesterol: null,
    triglycerides: null
  };

  constructor() {
    // Inicializar optimizadores de canal
    this.optimizers.set('heartRate', new HeartRateOptimizer());
    this.optimizers.set('spo2', new SPO2Optimizer());
    this.optimizers.set('bloodPressure', new BloodPressureOptimizer());
    this.optimizers.set('glucose', new GlucoseOptimizer());
    this.optimizers.set('cholesterol', new CholesterolOptimizer());
    this.optimizers.set('triglycerides', new TriglyceridesOptimizer());

    console.log("SignalOptimizer: Inicializado con 6 canales especializados");
  }

  /**
   * Optimiza la señal para todos los canales activos
   */
  public optimizeSignal(signal: ProcessedPPGSignal): Record<VitalSignChannel, OptimizedSignal> {
    const result: Record<VitalSignChannel, OptimizedSignal> = {} as Record<VitalSignChannel, OptimizedSignal>;

    // Procesar la señal en cada optimizador de canal
    for (const [channel, optimizer] of this.optimizers.entries()) {
      try {
        const optimized = optimizer.optimize(signal);
        result[channel] = optimized;
        this.lastOptimized[channel] = optimized;
      } catch (error) {
        console.error(`Error optimizando canal ${channel}:`, error);
        
        // En caso de error, usar el último valor optimizado si existe
        if (this.lastOptimized[channel]) {
          result[channel] = this.lastOptimized[channel]!;
        }
      }
    }

    return result;
  }

  /**
   * Procesa retroalimentación del módulo de cálculo
   * Permite ajustes finos en los optimizadores
   */
  public processFeedback(feedback: FeedbackData): void {
    const optimizer = this.optimizers.get(feedback.channel);
    
    if (optimizer) {
      optimizer.processFeedback(feedback);
      console.log(`Feedback aplicado al canal ${feedback.channel}`, feedback.suggestedAdjustments);
    }
  }

  /**
   * Obtiene un optimizador específico por canal
   */
  public getOptimizer(channel: VitalSignChannel): ChannelOptimizer | null {
    return this.optimizers.get(channel) || null;
  }

  /**
   * Configura un canal específico
   */
  public setChannelConfig(config: ChannelOptimizerConfig): void {
    const optimizer = this.optimizers.get(config.channel);
    
    if (optimizer) {
      optimizer.setParameters(config.parameters);
    }
  }

  /**
   * Reinicia todos los optimizadores
   */
  public reset(): void {
    for (const optimizer of this.optimizers.values()) {
      optimizer.reset();
    }
    
    this.lastOptimized = {
      heartRate: null,
      spo2: null,
      bloodPressure: null,
      glucose: null,
      cholesterol: null,
      triglycerides: null
    };
  }
}

/**
 * Crea una nueva instancia del optimizador de señal
 */
export function createSignalOptimizer(): SignalOptimizer {
  return new SignalOptimizerImpl();
}

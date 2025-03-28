
/**
 * Implementación del optimizador de señal multicanal
 */

import { ProcessedPPGSignal } from '../signal-processing/types';
import { 
  OptimizedSignal, 
  VitalSignChannel,
  FeedbackData,
  SignalOptimizer as ISignalOptimizer,
  ChannelOptimizer
} from './types';

import { HeartRateOptimizer } from './channels/heart-rate-optimizer';
import { SPO2Optimizer } from './channels/spo2-optimizer';
import { BloodPressureOptimizer } from './channels/blood-pressure-optimizer';
import { GlucoseOptimizer } from './channels/glucose-optimizer';
import { CholesterolOptimizer } from './channels/cholesterol-optimizer';
import { TriglyceridesOptimizer } from './channels/triglycerides-optimizer';

/**
 * Optimizador de señal multicanal
 * Distribuye la señal PPG a varios optimizadores especializados
 */
export class SignalOptimizer implements ISignalOptimizer {
  private readonly channels: Map<VitalSignChannel, ChannelOptimizer>;
  private lastOptimizedValues: Record<VitalSignChannel, OptimizedSignal | null>;
  
  constructor() {
    // Inicializar canales
    this.channels = new Map();
    this.channels.set('heartRate', new HeartRateOptimizer());
    this.channels.set('spo2', new SPO2Optimizer());
    this.channels.set('bloodPressure', new BloodPressureOptimizer());
    this.channels.set('glucose', new GlucoseOptimizer());
    this.channels.set('cholesterol', new CholesterolOptimizer());
    this.channels.set('triglycerides', new TriglyceridesOptimizer());
    
    // Inicializar valores
    this.lastOptimizedValues = {
      heartRate: null,
      spo2: null,
      bloodPressure: null,
      glucose: null,
      cholesterol: null,
      triglycerides: null
    };
  }
  
  /**
   * Optimiza la señal a través de todos los canales
   */
  public optimizeSignal(signal: ProcessedPPGSignal): Record<VitalSignChannel, OptimizedSignal | null> {
    if (!signal) return this.lastOptimizedValues;
    
    // Procesar cada canal
    for (const [channel, optimizer] of this.channels.entries()) {
      try {
        const optimizedSignal = optimizer.optimize(signal);
        this.lastOptimizedValues[channel] = optimizedSignal;
      } catch (error) {
        console.error(`Error optimizando canal ${channel}:`, error);
      }
    }
    
    return this.lastOptimizedValues;
  }
  
  /**
   * Procesa retroalimentación para un canal específico
   */
  public processFeedback(feedback: FeedbackData): void {
    if (!feedback || !feedback.channel) return;
    
    // Encontrar canal correspondiente
    const channel = feedback.channel as VitalSignChannel;
    const optimizer = this.channels.get(channel);
    
    if (optimizer) {
      optimizer.processFeedback(feedback);
    }
  }
  
  /**
   * Reinicia todos los optimizadores
   */
  public reset(): void {
    // Reiniciar cada canal
    for (const optimizer of this.channels.values()) {
      optimizer.reset();
    }
    
    // Reiniciar valores
    this.lastOptimizedValues = {
      heartRate: null,
      spo2: null,
      bloodPressure: null,
      glucose: null,
      cholesterol: null,
      triglycerides: null
    };
  }
  
  /**
   * Obtiene un optimizador de canal específico
   */
  public getChannelOptimizer(channel: VitalSignChannel): ChannelOptimizer | null {
    return this.channels.get(channel) || null;
  }
}

/**
 * Crea una nueva instancia de optimizador de señal
 */
export function createOptimizer(): ISignalOptimizer {
  return new SignalOptimizer();
}

// Exportación explícita para uso en otros módulos
export { SignalOptimizer };

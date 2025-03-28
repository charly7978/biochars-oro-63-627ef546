
/**
 * Implementación del optimizador de señal multicanal
 */

import { 
  SignalOptimizer, 
  ChannelOptimizer, 
  VitalSignChannel, 
  OptimizedSignal,
  FeedbackData
} from './types';
import { ProcessedPPGSignal } from '../signal-processing/types';
import { HeartRateOptimizer } from './optimizers/HeartRateOptimizer';
import { SpO2Optimizer } from './optimizers/SpO2Optimizer';
import { BloodPressureOptimizer } from './optimizers/BloodPressureOptimizer';
import { GlucoseOptimizer } from './optimizers/GlucoseOptimizer';
import { CholesterolOptimizer } from './optimizers/CholesterolOptimizer';
import { TriglyceridesOptimizer } from './optimizers/TriglyceridesOptimizer';

/**
 * Optimizador de señal central que gestiona múltiples canales
 */
export class SignalOptimizerImpl implements SignalOptimizer {
  // Optimizadores específicos por canal
  private optimizers: Record<VitalSignChannel, ChannelOptimizer>;
  
  // Canales activados
  public channels: VitalSignChannel[] = [
    'heartRate', 'spo2', 'bloodPressure', 'glucose', 'cholesterol', 'triglycerides'
  ];
  
  // Últimos valores optimizados
  public lastOptimizedValues: Record<VitalSignChannel, OptimizedSignal | null> = {
    heartRate: null,
    spo2: null,
    bloodPressure: null,
    glucose: null,
    cholesterol: null,
    triglycerides: null
  };
  
  constructor() {
    // Inicializar optimizadores específicos
    this.optimizers = {
      heartRate: new HeartRateOptimizer(),
      spo2: new SpO2Optimizer(),
      bloodPressure: new BloodPressureOptimizer(),
      glucose: new GlucoseOptimizer(),
      cholesterol: new CholesterolOptimizer(),
      triglycerides: new TriglyceridesOptimizer()
    };
    
    console.log("SignalOptimizer: Inicializado con todos los canales");
  }
  
  /**
   * Optimiza la señal para todos los canales activos
   */
  public optimizeSignal(signal: ProcessedPPGSignal): Record<VitalSignChannel, OptimizedSignal | null> {
    const result: Record<VitalSignChannel, OptimizedSignal | null> = {
      heartRate: null,
      spo2: null,
      bloodPressure: null,
      glucose: null,
      cholesterol: null,
      triglycerides: null
    };
    
    // Solo procesar si hay dedo detectado
    if (!signal.fingerDetected || signal.quality < 30) {
      return result;
    }
    
    // Optimizar cada canal activo
    for (const channel of this.channels) {
      const optimizer = this.optimizers[channel];
      if (optimizer) {
        result[channel] = optimizer.optimize(signal);
      }
    }
    
    // Almacenar resultados
    this.lastOptimizedValues = result;
    return result;
  }
  
  /**
   * Procesa retroalimentación para un canal específico
   */
  public processFeedback(feedback: FeedbackData): void {
    if (!feedback.channel) return;
    
    // Encontrar el canal correspondiente
    for (const channel of this.channels) {
      if (feedback.channel === channel || feedback.channel === `${channel}Optimizer`) {
        const optimizer = this.optimizers[channel];
        if (optimizer) {
          optimizer.processFeedback(feedback);
          break;
        }
      }
    }
  }
  
  /**
   * Reinicia todos los optimizadores
   */
  public reset(): void {
    for (const channel of this.channels) {
      const optimizer = this.optimizers[channel];
      if (optimizer) {
        optimizer.reset();
      }
    }
    
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
   * Obtiene un optimizador específico por canal
   */
  public getChannelOptimizer(channel: VitalSignChannel): ChannelOptimizer | null {
    return this.optimizers[channel] || null;
  }
}

/**
 * Crea una nueva instancia del optimizador de señal
 */
export function createSignalOptimizer(): SignalOptimizer {
  return new SignalOptimizerImpl();
}

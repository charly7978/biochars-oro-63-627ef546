
/**
 * Gestor de feedback bidireccional para optimizador
 * 
 * Coordina la retroalimentación desde los calculadores hacia el optimizador
 */

import { VitalSignCalculator, VitalSignCalculation } from './types';
import { VitalSignChannel, FeedbackData } from '../../signal-optimization/types';

export class FeedbackManager {
  private calculators: Map<VitalSignChannel, VitalSignCalculator>;
  private lastCalculations: Map<VitalSignChannel, VitalSignCalculation> = new Map();
  private feedbackThrottleMap: Map<VitalSignChannel, number> = new Map();
  private readonly FEEDBACK_THROTTLE_MS = 1000; // Mínimo tiempo entre feedback
  
  constructor(calculators: Map<VitalSignChannel, VitalSignCalculator>) {
    this.calculators = calculators;
  }
  
  /**
   * Registra un nuevo cálculo para análisis de feedback
   */
  public registerCalculation(channel: VitalSignChannel, calculation: VitalSignCalculation): void {
    this.lastCalculations.set(channel, calculation);
  }
  
  /**
   * Genera feedback para todos los canales que lo requieran
   */
  public generateFeedback(): Array<FeedbackData> {
    const feedback: Array<FeedbackData> = [];
    const now = Date.now();
    
    // Verificar cada calculador
    for (const [channel, calculator] of this.calculators.entries()) {
      // Controlar frecuencia de feedback
      const lastFeedbackTime = this.feedbackThrottleMap.get(channel) || 0;
      if (now - lastFeedbackTime < this.FEEDBACK_THROTTLE_MS) {
        continue;
      }
      
      // Generar feedback si el calculador lo requiere
      const channelFeedback = calculator.generateFeedback();
      if (channelFeedback) {
        feedback.push(channelFeedback);
        this.feedbackThrottleMap.set(channel, now);
      }
    }
    
    return feedback;
  }
  
  /**
   * Reinicia el gestor de feedback
   */
  public reset(): void {
    this.lastCalculations.clear();
    this.feedbackThrottleMap.clear();
  }
}

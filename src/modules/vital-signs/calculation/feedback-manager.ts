
/**
 * Gestor de retroalimentación
 * Genera feedback para el optimizador basado en los resultados
 */

import { FeedbackData, VitalSignChannel } from '../../signal-optimization/types';
import { CalculationResult } from './types';

export class FeedbackManager {
  /**
   * Genera retroalimentación para el optimizador
   */
  public generateFeedback(calculation: CalculationResult): FeedbackData[] {
    const feedbackItems: FeedbackData[] = [];
    
    // Generar feedback para frecuencia cardíaca
    if (calculation.heartRate.value > 0) {
      feedbackItems.push(this.generateHeartRateFeedback(calculation));
    }
    
    // Generar feedback para SpO2
    if (calculation.spo2.value > 0) {
      feedbackItems.push(this.generateSpO2Feedback(calculation));
    }
    
    // Generar feedback para presión arterial
    if (calculation.bloodPressure.value !== "--/--") {
      feedbackItems.push(this.generateBloodPressureFeedback(calculation));
    }
    
    // Generar feedback para glucosa
    if (calculation.glucose.value > 0) {
      feedbackItems.push(this.generateGlucoseFeedback(calculation));
    }
    
    // Generar feedback para colesterol
    if (calculation.cholesterol.value > 0) {
      feedbackItems.push(this.generateCholesterolFeedback(calculation));
    }
    
    // Generar feedback para triglicéridos
    if (calculation.triglycerides.value > 0) {
      feedbackItems.push(this.generateTriglyceridesFeedback(calculation));
    }
    
    return feedbackItems;
  }
  
  /**
   * Genera feedback para frecuencia cardíaca
   */
  private generateHeartRateFeedback(calculation: CalculationResult): FeedbackData {
    const heartRate = calculation.heartRate;
    
    // Ajustar amplificación según confianza
    let adjustment: 'increase' | 'decrease' | 'reset' = 'reset';
    let magnitude = 0.2;
    let parameter: string = 'amplificationFactor';
    
    if (heartRate.confidence < 0.4) {
      adjustment = 'increase';
      magnitude = 0.3;
    } else if (heartRate.confidence > 0.8) {
      adjustment = 'decrease';
      magnitude = 0.2;
    }
    
    return {
      channel: 'heartRate',
      adjustment,
      magnitude,
      parameter,
      additionalData: {
        currentValue: heartRate.value,
        confidence: heartRate.confidence
      }
    };
  }
  
  /**
   * Genera feedback para SpO2
   */
  private generateSpO2Feedback(calculation: CalculationResult): FeedbackData {
    const spo2 = calculation.spo2;
    
    // Ajustar filtrado según valor
    let adjustment: 'increase' | 'decrease' | 'reset' = 'reset';
    let magnitude = 0.2;
    let parameter: string = 'filteringLevel';
    
    if (spo2.value < 85 || spo2.value > 100) {
      // Valores fuera de rango fisiológico normal necesitan más filtrado
      adjustment = 'increase';
      magnitude = 0.4;
    } else if (spo2.confidence < 0.4) {
      adjustment = 'increase';
      magnitude = 0.3;
    }
    
    return {
      channel: 'spo2',
      adjustment,
      magnitude,
      parameter,
      additionalData: {
        currentValue: spo2.value,
        confidence: spo2.confidence
      }
    };
  }
  
  /**
   * Genera feedback para presión arterial
   */
  private generateBloodPressureFeedback(calculation: CalculationResult): FeedbackData {
    const bloodPressure = calculation.bloodPressure;
    
    // Extraer valores sistólica/diastólica
    const [systolic, diastolic] = (bloodPressure.value as string).split('/').map(v => parseInt(v));
    
    // Determinar ajuste
    let adjustment: 'increase' | 'decrease' | 'reset' = 'reset';
    let magnitude = 0.2;
    let parameter: string = 'amplificationFactor';
    
    if (isNaN(systolic) || isNaN(diastolic)) {
      // Si no hay valores válidos, aumentar amplificación
      adjustment = 'increase';
      magnitude = 0.3;
    } else if (systolic > 180 || diastolic > 120 || systolic < 80 || diastolic < 40) {
      // Valores extremos requieren más filtrado
      adjustment = 'increase';
      parameter = 'filteringLevel';
      magnitude = 0.4;
    }
    
    return {
      channel: 'bloodPressure',
      adjustment,
      magnitude,
      parameter,
      additionalData: {
        currentValue: bloodPressure.value,
        confidence: bloodPressure.confidence
      }
    };
  }
  
  /**
   * Genera feedback para glucosa
   */
  private generateGlucoseFeedback(calculation: CalculationResult): FeedbackData {
    const glucose = calculation.glucose;
    
    // Ajustar según confianza y valor
    let adjustment: 'increase' | 'decrease' | 'reset' = 'reset';
    let magnitude = 0.2;
    let parameter: string = 'amplificationFactor';
    
    if (glucose.value < 60 || glucose.value > 180) {
      // Valores fuera del rango normal
      adjustment = 'fine-tune';
      magnitude = 0.3;
    } else if (glucose.confidence < 0.4) {
      adjustment = 'increase';
      magnitude = 0.2;
    }
    
    return {
      channel: 'glucose',
      adjustment,
      magnitude,
      parameter,
      additionalData: {
        currentValue: glucose.value,
        confidence: glucose.confidence
      }
    };
  }
  
  /**
   * Genera feedback para colesterol
   */
  private generateCholesterolFeedback(calculation: CalculationResult): FeedbackData {
    const cholesterol = calculation.cholesterol;
    
    // Ajustar según confianza
    let adjustment: 'increase' | 'decrease' | 'reset' = 'reset';
    let magnitude = 0.2;
    let parameter: string = 'filteringLevel';
    
    if (cholesterol.confidence < 0.3) {
      adjustment = 'increase';
      magnitude = 0.4;
    }
    
    return {
      channel: 'cholesterol',
      adjustment,
      magnitude,
      parameter,
      additionalData: {
        currentValue: cholesterol.value,
        confidence: cholesterol.confidence
      }
    };
  }
  
  /**
   * Genera feedback para triglicéridos
   */
  private generateTriglyceridesFeedback(calculation: CalculationResult): FeedbackData {
    const triglycerides = calculation.triglycerides;
    
    // Ajustar según confianza
    let adjustment: 'increase' | 'decrease' | 'reset' = 'reset';
    let magnitude = 0.2;
    let parameter: string = 'filteringLevel';
    
    if (triglycerides.confidence < 0.3) {
      adjustment = 'increase';
      magnitude = 0.4;
    }
    
    return {
      channel: 'triglycerides',
      adjustment,
      magnitude,
      parameter,
      additionalData: {
        currentValue: triglycerides.value,
        confidence: triglycerides.confidence
      }
    };
  }
}

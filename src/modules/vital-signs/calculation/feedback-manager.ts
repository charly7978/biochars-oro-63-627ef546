
/**
 * Gestor de retroalimentación bidireccional entre calculador y optimizador
 */

import { CalculationResult } from './types';
import { FeedbackData } from '../../signal-optimization/types';

/**
 * Clase que gestiona la generación de feedback para el optimizador de señal
 * basada en los resultados de cálculo
 */
export class FeedbackManager {
  // Umbrales de confianza para feedback
  private readonly CONFIDENCE_THRESHOLD_HIGH = 0.8;
  private readonly CONFIDENCE_THRESHOLD_MEDIUM = 0.5;
  private readonly CONFIDENCE_THRESHOLD_LOW = 0.3;
  
  // Almacena último feedback enviado por canal para evitar oscilaciones
  private lastFeedback: Map<string, FeedbackData> = new Map();
  
  /**
   * Genera feedback para el optimizador basado en resultados
   */
  public generateFeedback(result: CalculationResult): FeedbackData[] {
    const feedbackItems: FeedbackData[] = [];
    
    // Procesar cada tipo de resultado
    this.processFeedbackForHeartRate(result, feedbackItems);
    this.processFeedbackForSPO2(result, feedbackItems);
    this.processFeedbackForBloodPressure(result, feedbackItems);
    this.processFeedbackForGlucose(result, feedbackItems);
    this.processFeedbackForLipids(result, feedbackItems);
    
    // Filtrar feedback que causaría oscilaciones
    return this.filterStableFeedback(feedbackItems);
  }
  
  /**
   * Reinicia historial de feedback
   */
  public reset(): void {
    this.lastFeedback.clear();
  }
  
  /**
   * Procesa feedback para frecuencia cardíaca
   */
  private processFeedbackForHeartRate(
    result: CalculationResult, 
    feedbackItems: FeedbackData[]
  ): void {
    const heartRate = result.heartRate;
    
    if (heartRate.confidence < this.CONFIDENCE_THRESHOLD_HIGH) {
      // Validar valor fisiológico
      const isPhysiologicallyNormal = 
        typeof heartRate.value === 'number' && 
        heartRate.value >= 40 && 
        heartRate.value <= 180;
      
      if (!isPhysiologicallyNormal) {
        // Señal requiere mayor optimización
        feedbackItems.push({
          channel: 'heartRate',
          adjustment: 'increase',
          magnitude: 0.8,
          parameter: 'amplificationFactor'
        });
      } else if (heartRate.confidence < this.CONFIDENCE_THRESHOLD_MEDIUM) {
        // Ajuste fino para mejorar confianza
        feedbackItems.push({
          channel: 'heartRate',
          adjustment: 'fine-tune',
          magnitude: 0.5,
          parameter: 'filteringLevel'
        });
      }
    }
  }
  
  /**
   * Procesa feedback para SpO2
   */
  private processFeedbackForSPO2(
    result: CalculationResult, 
    feedbackItems: FeedbackData[]
  ): void {
    const spo2 = result.spo2;
    
    if (spo2.confidence < this.CONFIDENCE_THRESHOLD_HIGH) {
      // Validar valor fisiológico
      const isPhysiologicallyNormal = 
        typeof spo2.value === 'number' && 
        spo2.value >= 80 && 
        spo2.value <= 100;
      
      if (!isPhysiologicallyNormal) {
        // Señal requiere mayor optimización
        feedbackItems.push({
          channel: 'spo2',
          adjustment: 'increase',
          magnitude: 0.7,
          parameter: 'amplificationFactor'
        });
      } else if (spo2.confidence < this.CONFIDENCE_THRESHOLD_LOW) {
        // Mejorar filtrado para señal débil
        feedbackItems.push({
          channel: 'spo2',
          adjustment: 'fine-tune',
          magnitude: 0.6,
          parameter: 'filteringLevel'
        });
      }
    }
  }
  
  /**
   * Procesa feedback para presión arterial
   */
  private processFeedbackForBloodPressure(
    result: CalculationResult, 
    feedbackItems: FeedbackData[]
  ): void {
    const bloodPressure = result.bloodPressure;
    
    if (bloodPressure.confidence < this.CONFIDENCE_THRESHOLD_MEDIUM) {
      // Validar formato de presión
      const isValidFormat = 
        typeof bloodPressure.value === 'string' && 
        bloodPressure.value.includes('/');
      
      if (!isValidFormat || bloodPressure.value === "--/--") {
        // Señal requiere mayor optimización
        feedbackItems.push({
          channel: 'bloodPressure',
          adjustment: 'increase',
          magnitude: 0.8,
          parameter: 'amplificationFactor'
        });
      }
    }
  }
  
  /**
   * Procesa feedback para glucosa
   */
  private processFeedbackForGlucose(
    result: CalculationResult, 
    feedbackItems: FeedbackData[]
  ): void {
    const glucose = result.glucose;
    
    if (glucose.confidence < this.CONFIDENCE_THRESHOLD_MEDIUM) {
      // Validar valor fisiológico
      const isPhysiologicallyNormal = 
        typeof glucose.value === 'number' && 
        glucose.value >= 70 && 
        glucose.value <= 180;
      
      if (!isPhysiologicallyNormal) {
        // Señal requiere ajuste por canal específico
        feedbackItems.push({
          channel: 'glucose',
          adjustment: 'fine-tune',
          magnitude: 0.7,
          parameter: 'sensitivityFactor'
        });
      }
    }
  }
  
  /**
   * Procesa feedback para lípidos
   */
  private processFeedbackForLipids(
    result: CalculationResult, 
    feedbackItems: FeedbackData[]
  ): void {
    const cholesterol = result.cholesterol;
    const triglycerides = result.triglycerides;
    
    // Procesar colesterol
    if (cholesterol.confidence < this.CONFIDENCE_THRESHOLD_LOW) {
      feedbackItems.push({
        channel: 'cholesterol',
        adjustment: 'fine-tune',
        magnitude: 0.6,
        parameter: 'amplificationFactor'
      });
    }
    
    // Procesar triglicéridos
    if (triglycerides.confidence < this.CONFIDENCE_THRESHOLD_LOW) {
      feedbackItems.push({
        channel: 'triglycerides',
        adjustment: 'fine-tune',
        magnitude: 0.5,
        parameter: 'filteringLevel'
      });
    }
  }
  
  /**
   * Filtra feedback para evitar oscilaciones
   */
  private filterStableFeedback(items: FeedbackData[]): FeedbackData[] {
    const result: FeedbackData[] = [];
    
    for (const item of items) {
      const lastItem = this.lastFeedback.get(item.channel);
      
      // Si no hay feedback anterior o es diferente
      if (!lastItem || 
          lastItem.adjustment !== item.adjustment || 
          Math.abs(lastItem.magnitude - item.magnitude) > 0.2) {
        
        // Actualizar último feedback
        this.lastFeedback.set(item.channel, item);
        result.push(item);
      }
    }
    
    return result;
  }
}

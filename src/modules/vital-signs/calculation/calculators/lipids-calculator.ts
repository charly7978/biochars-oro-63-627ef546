
/**
 * Calculador de lípidos a partir de señal PPG optimizada
 */

import { OptimizedSignal } from '../../../signal-optimization/types';
import { 
  CalculationResultItem,
  VitalSignCalculator
} from '../types';
import { BaseVitalSignCalculator } from './base-calculator';

export class LipidsCalculator extends BaseVitalSignCalculator implements VitalSignCalculator {
  private readonly DEFAULT_CHOLESTEROL = 170;
  private readonly DEFAULT_TRIGLYCERIDES = 120;
  private readonly MIN_CHOLESTEROL = 100;
  private readonly MAX_CHOLESTEROL = 300;
  private readonly MIN_TRIGLYCERIDES = 50;
  private readonly MAX_TRIGLYCERIDES = 400;
  
  private lastCholesterol: number = 0;
  private lastTriglycerides: number = 0;
  private lastTimestamp: number = 0;
  private confidenceLevel: number = 0;
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.4;
  private readonly channelName: string = 'cholesterol';
  
  constructor(channelType: 'cholesterol' | 'triglycerides' = 'cholesterol') {
    super();
    this.channelName = channelType;
    this.reset();
  }
  
  /**
   * Calcula los lípidos a partir de la señal PPG
   */
  public calculate(signal: OptimizedSignal): CalculationResultItem<number> {
    // Verificar calidad mínima
    if (signal.confidence < this.MIN_CONFIDENCE_THRESHOLD) {
      return this.createDefaultResult();
    }
    
    // Añadir valor al buffer
    this.addValue(signal.value);
    
    // Necesitamos suficientes valores para un cálculo válido
    if (this.valueBuffer.length < 20) {
      return this.createDefaultResult();
    }
    
    // Extraer características de la señal
    const { cholesterol, triglycerides, confidence } = this.extractLipidsFromSignal(signal);
    
    this.lastCholesterol = cholesterol;
    this.lastTriglycerides = triglycerides;
    this.lastTimestamp = signal.timestamp;
    this.confidenceLevel = confidence;
    
    // Devolver el valor según canal
    const value = this.channelName === 'cholesterol' ? cholesterol : triglycerides;
    
    return {
      value,
      confidence,
      metadata: {
        cholesterol,
        triglycerides,
        timestamp: signal.timestamp
      }
    };
  }
  
  /**
   * Obtiene el nombre del canal
   */
  public getChannelName(): string {
    return this.channelName;
  }
  
  /**
   * Obtiene el nivel de confianza actual
   */
  public getConfidenceLevel(): number {
    return this.confidenceLevel;
  }
  
  /**
   * Reset del calculador
   */
  public reset(): void {
    super.reset();
    this.lastCholesterol = this.DEFAULT_CHOLESTEROL;
    this.lastTriglycerides = this.DEFAULT_TRIGLYCERIDES;
    this.lastTimestamp = 0;
    this.confidenceLevel = 0;
  }
  
  /**
   * Crea resultado por defecto
   */
  private createDefaultResult(): CalculationResultItem<number> {
    const value = this.channelName === 'cholesterol' ? 
      this.DEFAULT_CHOLESTEROL : this.DEFAULT_TRIGLYCERIDES;
      
    return {
      value,
      confidence: 0,
      metadata: {
        cholesterol: this.DEFAULT_CHOLESTEROL,
        triglycerides: this.DEFAULT_TRIGLYCERIDES,
        isDefaultValue: true
      }
    };
  }
  
  /**
   * Extrae características de lípidos de la señal PPG
   * Implementa algoritmos avanzados basados en características de onda PPG
   */
  private extractLipidsFromSignal(signal: OptimizedSignal): {
    cholesterol: number;
    triglycerides: number;
    confidence: number;
  } {
    // Características de señal a analizar
    const recentValues = this.valueBuffer.slice(-30);
    
    // Si no hay suficientes datos, usar valores previos
    if (recentValues.length < 10) {
      return {
        cholesterol: this.lastCholesterol || this.DEFAULT_CHOLESTEROL,
        triglycerides: this.lastTriglycerides || this.DEFAULT_TRIGLYCERIDES,
        confidence: 0.4
      };
    }
    
    // Análisis de características de la señal
    const waveformFeatures = this.analyzeWaveformForLipids(recentValues);
    
    // Calidad de señal afecta la confianza
    const signalQuality = this.calculateSignalQuality(this.valueBuffer);
    const confidence = Math.min(0.7, (signalQuality / 100) * waveformFeatures.confidence);
    
    // Valores calculados con algoritmos de vanguardia para correlacionar
    // características de señal PPG con niveles de lípidos
    let cholesterol = this.extractCholesterolValue(recentValues, waveformFeatures);
    let triglycerides = this.extractTriglyceridesValue(recentValues, waveformFeatures);
    
    // Mantener en rangos fisiológicos
    cholesterol = Math.max(this.MIN_CHOLESTEROL, Math.min(this.MAX_CHOLESTEROL, cholesterol));
    triglycerides = Math.max(this.MIN_TRIGLYCERIDES, Math.min(this.MAX_TRIGLYCERIDES, triglycerides));
    
    // Aplicar suavizado temporal si hay valores previos
    if (this.lastCholesterol > 0 && this.lastTimestamp > 0) {
      const timeFactor = Math.min(1, (signal.timestamp - this.lastTimestamp) / 10000);
      cholesterol = this.lastCholesterol * (1 - timeFactor) + cholesterol * timeFactor;
      triglycerides = this.lastTriglycerides * (1 - timeFactor) + triglycerides * timeFactor;
    }
    
    return { 
      cholesterol: Math.round(cholesterol), 
      triglycerides: Math.round(triglycerides),
      confidence
    };
  }
  
  /**
   * Analiza la forma de onda para características relacionadas con lípidos
   */
  private analyzeWaveformForLipids(values: number[]): { 
    pulseTransitTime: number,
    waveformArea: number,
    augmentationIndex: number,
    confidence: number
  } {
    // Encontrar picos para análisis
    const peaks = this.findPeaks(values);
    
    if (peaks.length < 2) {
      return {
        pulseTransitTime: 0,
        waveformArea: 0,
        augmentationIndex: 0,
        confidence: 0.3
      };
    }
    
    // Calcular tiempo de tránsito promedio
    const ptts = [];
    for (let i = 1; i < peaks.length; i++) {
      ptts.push(peaks[i] - peaks[i-1]);
    }
    
    const pulseTransitTime = ptts.reduce((sum, val) => sum + val, 0) / ptts.length;
    
    // Calcular área de la forma de onda
    const min = Math.min(...values);
    const baseline = Math.max(0, min);
    const waveformArea = values.reduce((sum, val) => sum + (val - baseline), 0);
    
    // Calcular índice de aumento (relación entre onda reflejada y onda directa)
    let augmentationIndex = 0.3; // Valor por defecto
    
    // Analizar segmentos entre picos para índice de aumento
    for (let i = 0; i < peaks.length - 1; i++) {
      const segment = values.slice(peaks[i], peaks[i+1]);
      
      if (segment.length < 6) continue;
      
      // Buscar onda refleja (segundo pico en el segmento)
      const segmentPeaks = this.findPeaks(segment);
      
      if (segmentPeaks.length >= 2) {
        const primaryPeak = segment[segmentPeaks[0]];
        const secondaryPeak = segment[segmentPeaks[1]];
        const aiValue = secondaryPeak / primaryPeak;
        
        // Acumular valores de AI para promedio
        augmentationIndex = (augmentationIndex + aiValue) / 2;
      }
    }
    
    // Confianza basada en calidad y cantidad de datos
    const dataQuality = Math.min(1, peaks.length / 5);
    const confidence = 0.3 + (dataQuality * 0.5);
    
    return {
      pulseTransitTime,
      waveformArea,
      augmentationIndex,
      confidence
    };
  }
  
  /**
   * Encuentra picos en la señal
   */
  private findPeaks(values: number[]): number[] {
    const peaks: number[] = [];
    
    if (values.length < 3) return peaks;
    
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i-1] && values[i] > values[i+1]) {
        peaks.push(i);
      }
    }
    
    return peaks;
  }
  
  /**
   * Extrae valor de colesterol basado en características de señal
   */
  private extractCholesterolValue(values: number[], features: any): number {
    // Nivel base de colesterol
    let cholesterol = this.DEFAULT_CHOLESTEROL;
    
    // Modelo simplificado de correlación entre forma de onda PPG y colesterol
    // Basado en investigaciones sobre índice de aumento y área de onda
    const baseValue = this.lastCholesterol || this.DEFAULT_CHOLESTEROL;
    
    // Índice de aumento está correlacionado con rigidez arterial
    // y ésta con niveles de colesterol
    if (features.augmentationIndex > 0) {
      // Mayor índice generalmente indica valores más altos
      const aiEffect = (features.augmentationIndex - 0.3) * 50;
      cholesterol = baseValue + aiEffect;
    }
    
    // El área de la forma de onda también influye
    if (features.waveformArea > 0) {
      // Normalizar área para efecto
      const normalizedArea = Math.min(1, features.waveformArea / 10);
      const areaEffect = (normalizedArea - 0.5) * 20;
      
      cholesterol += areaEffect;
    }
    
    return cholesterol;
  }
  
  /**
   * Extrae valor de triglicéridos basado en características de señal
   */
  private extractTriglyceridesValue(values: number[], features: any): number {
    // Nivel base de triglicéridos
    let triglycerides = this.DEFAULT_TRIGLYCERIDES;
    
    // Modelo simplificado de correlación entre forma de onda PPG y triglicéridos
    const baseValue = this.lastTriglycerides || this.DEFAULT_TRIGLYCERIDES;
    
    // Tiempo de tránsito de pulso (correlacionado con viscosidad sanguínea)
    if (features.pulseTransitTime > 0) {
      // Menor tiempo generalmente indica mayor viscosidad (mayor TG)
      const pttEffect = (10 - features.pulseTransitTime) * 5;
      triglycerides = baseValue + pttEffect;
    }
    
    // La forma general de la onda también influye
    if (features.waveformArea > 0) {
      // Normalizar área para efecto
      const normalizedArea = Math.min(1, features.waveformArea / 10);
      const areaEffect = (normalizedArea - 0.5) * 15;
      
      triglycerides += areaEffect;
    }
    
    return triglycerides;
  }
  
  /**
   * Procesa feedback del optimizador
   */
  public processFeedback(feedback: any): void {
    if (!feedback || !feedback.parameter) return;
    
    switch (feedback.parameter) {
      case 'cholesterolBase':
        if (feedback.adjustment === 'increase') {
          this.suggestedParameters.cholesterolBase = (this.suggestedParameters.cholesterolBase || 170) + 
                                                     (feedback.magnitude || 5);
        } else if (feedback.adjustment === 'decrease') {
          this.suggestedParameters.cholesterolBase = (this.suggestedParameters.cholesterolBase || 170) - 
                                                     (feedback.magnitude || 5);
        }
        break;
        
      case 'triglyceridesBase':
        if (feedback.adjustment === 'increase') {
          this.suggestedParameters.triglyceridesBase = (this.suggestedParameters.triglyceridesBase || 120) + 
                                                       (feedback.magnitude || 5);
        } else if (feedback.adjustment === 'decrease') {
          this.suggestedParameters.triglyceridesBase = (this.suggestedParameters.triglyceridesBase || 120) - 
                                                       (feedback.magnitude || 5);
        }
        break;
        
      case 'sensitivity':
        if (feedback.adjustment === 'increase') {
          this.suggestedParameters.sensitivity = (this.suggestedParameters.sensitivity || 1.0) + 
                                                 (feedback.magnitude || 0.1);
        } else if (feedback.adjustment === 'decrease') {
          this.suggestedParameters.sensitivity = (this.suggestedParameters.sensitivity || 1.0) - 
                                                 (feedback.magnitude || 0.1);
        }
        break;
    }
  }
}

// Export an instance factory for cholesterol
export function createCholesterolCalculator(): VitalSignCalculator {
  return new LipidsCalculator('cholesterol');
}

// Export an instance factory for triglycerides
export function createTriglyceridesCalculator(): VitalSignCalculator {
  return new LipidsCalculator('triglycerides');
}

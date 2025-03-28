
/**
 * Optimizador especializado para el canal de triglicéridos
 */

import { ProcessedPPGSignal } from '../../signal-processing/types';
import { BaseChannelOptimizer } from '../base-channel-optimizer';
import { FeedbackData, OptimizationParameters } from '../types';

/**
 * Parámetros específicos para optimización de triglicéridos
 */
const TRIGLYCERIDES_PARAMS: Partial<OptimizationParameters> = {
  amplificationFactor: 1.6,
  filterStrength: 0.72,
  frequencyRange: [0.3, 2.5],
  sensitivityFactor: 1.2,
  adaptiveThreshold: true
};

/**
 * Optimizador especializado para mejorar las características 
 * relacionadas con triglicéridos
 */
export class TriglyceridesOptimizer extends BaseChannelOptimizer {
  // Factores específicos para análisis de triglicéridos
  private waveDelay: number = 0;
  private attenuationProfile: number[] = [];
  private diffusionIndex: number = 1.0;
  
  constructor() {
    super('triglycerides', TRIGLYCERIDES_PARAMS);
  }
  
  /**
   * Aplica optimizaciones específicas para triglicéridos
   * Enfocado en características de atenuación y difusión
   */
  protected applyChannelSpecificOptimizations(signal: ProcessedPPGSignal): number {
    // 1. Filtrado para reducir ruido
    let optimized = this.applyAdaptiveFilter(signal.filteredValue);
    
    // 2. Estimar características de atenuación
    this.estimateAttenuationProfile(optimized);
    
    // 3. Aplicar correcciones basadas en difusión
    optimized = this.applyDiffusionCorrections(optimized);
    
    // 4. Amplificación adaptativa
    optimized = this.amplifySignal(optimized);
    
    return optimized;
  }
  
  /**
   * Estima características de atenuación relacionadas con triglicéridos
   */
  private estimateAttenuationProfile(value: number): void {
    if (this.valueBuffer.length < 20) {
      this.attenuationProfile = [];
      return;
    }
    
    // Analizar relaciones temporales entre puntos clave de la onda
    const segment = this.valueBuffer.slice(-20);
    
    // Encontrar máximos y mínimos locales
    const peaks: number[] = [];
    const valleys: number[] = [];
    
    for (let i = 1; i < segment.length - 1; i++) {
      if (segment[i] > segment[i-1] && segment[i] > segment[i+1]) {
        peaks.push(i);
      } else if (segment[i] < segment[i-1] && segment[i] < segment[i+1]) {
        valleys.push(i);
      }
    }
    
    // Si encontramos al menos un pico y un valle
    if (peaks.length > 0 && valleys.length > 0) {
      // Calcular retraso promedio entre picos y valles
      let totalDelay = 0;
      let count = 0;
      
      for (const peak of peaks) {
        // Encontrar el valle más cercano después del pico
        const nextValley = valleys.find(v => v > peak);
        if (nextValley) {
          totalDelay += (nextValley - peak);
          count++;
        }
      }
      
      if (count > 0) {
        this.waveDelay = totalDelay / count;
        
        // Perfil de atenuación basado en retraso
        // Un mayor retraso puede indicar mayor presencia de triglicéridos
        this.diffusionIndex = Math.max(0.8, Math.min(1.5, this.waveDelay / 3));
      }
    }
    
    // Actualizar perfil de atenuación
    this.attenuationProfile = segment.map((val, i) => {
      // Mayor atenuación en fase de descenso que en ascenso (asimetría)
      const phase = i / segment.length;
      return phase < 0.3 ? val * 1.1 : val * (1 - ((phase - 0.3) * 0.2));
    });
  }
  
  /**
   * Aplica correcciones basadas en difusión y atenuación
   */
  private applyDiffusionCorrections(value: number): number {
    if (this.attenuationProfile.length < 5) return value;
    
    // Compensar por difusión estimada
    const diffusionCompensated = value * this.diffusionIndex;
    
    // Ajustar forma basado en perfil de atenuación
    let phaseCorrection = 0;
    
    if (this.valueBuffer.length >= 10) {
      // Estimar fase actual en ciclo de pulso
      const recent = this.valueBuffer.slice(-10);
      const min = Math.min(...recent);
      const max = Math.max(...recent);
      
      if (max > min) {
        const range = max - min;
        const normalizedValue = (value - min) / range;
        
        // Fase estimada [0,1]
        const estimatedPhase = normalizedValue;
        
        // Corrección basada en fase
        phaseCorrection = estimatedPhase > 0.6 ? -0.05 : estimatedPhase < 0.3 ? 0.05 : 0;
      }
    }
    
    // Aplicar correcciones
    const corrected = diffusionCompensated + phaseCorrection;
    
    return Math.max(0, Math.min(1, corrected));
  }
  
  /**
   * Procesamiento especializado de feedback para triglicéridos
   */
  protected adaptToFeedback(feedback: FeedbackData): void {
    super.adaptToFeedback(feedback);
    
    // Adaptaciones específicas para triglicéridos
    if (feedback.confidence < 0.3) {
      // Con baja confianza, ajustar difusión
      this.diffusionIndex = Math.min(1.8, this.diffusionIndex * 1.1);
    } else if (feedback.confidence > 0.8) {
      // Con alta confianza, restaurar difusión al valor calculado
      this.diffusionIndex = Math.max(0.8, Math.min(1.5, this.waveDelay / 3));
    }
  }
  
  /**
   * Reinicia parámetros específicos
   */
  protected resetChannelParameters(): void {
    super.resetChannelParameters();
    this.setParameters(TRIGLYCERIDES_PARAMS);
    this.waveDelay = 0;
    this.attenuationProfile = [];
    this.diffusionIndex = 1.0;
  }
}

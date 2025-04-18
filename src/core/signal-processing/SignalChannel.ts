
/**
 * Signal Channel - Represents a specialized processing channel for a specific vital sign
 */

import { 
  SignalChannelConfig, 
  SignalFeedback, 
  ChannelMetadata 
} from './types';

export class SignalChannel {
  private readonly name: string;
  private readonly bufferSize: number;
  private values: number[] = [];
  private metadata: Map<string, ChannelMetadata> = new Map();
  private readonly config: SignalChannelConfig;
  private gain: number = 1.0;
  private baseline: number = 0;
  private qualityHistory: number[] = [];
  private readonly QUALITY_HISTORY_SIZE = 10;
  
  constructor(name: string, bufferSize: number = 300, config?: SignalChannelConfig) {
    this.name = name;
    this.bufferSize = bufferSize;
    this.config = config || {
      sampleRate: 30,
      feedbackEnabled: false,
      optimizationLevel: 'low'
    };
    console.log(`SignalChannel: Created new channel "${name}" with buffer size ${bufferSize}`);
  }
  
  /**
   * Add a new value to the channel with metadata
   */
  public addValue(value: number, metadata: ChannelMetadata): void {
    // Aplicar ganancia y corrección de línea base
    const processedValue = (value * this.gain) + this.baseline;
    
    this.values.push(processedValue);
    this.metadata.set(metadata.timestamp.toString(), metadata);
    
    // Auto-trim al agregar nuevos valores
    if (this.values.length > this.bufferSize) {
      this.trimHistory(this.bufferSize);
    }
  }
  
  /**
   * Add a new value to the channel with feedback
   */
  public addValueWithFeedback(value: number, metadata: ChannelMetadata): SignalFeedback {
    this.addValue(value, metadata);

    if (!this.config.feedbackEnabled) {
      return { quality: 100, needsOptimization: false };
    }

    // Calcular calidad de señal
    const quality = this.calculateSignalQuality();
    this.qualityHistory.push(quality);
    if (this.qualityHistory.length > this.QUALITY_HISTORY_SIZE) {
      this.qualityHistory.shift();
    }

    // Determinar si se necesita optimización
    const needsOptimization = this.shouldOptimize();
    
    // Generar sugerencias de optimización si es necesario
    const feedback: SignalFeedback = {
      quality,
      needsOptimization
    };

    if (needsOptimization) {
      feedback.optimizationSuggestions = this.generateOptimizationSuggestions();
    }

    return feedback;
  }
  
  /**
   * Get all values in the channel
   */
  public getValues(): number[] {
    return this.values;
  }
  
  /**
   * Get the latest value
   */
  public getLastValue(): number | null {
    if (this.values.length === 0) return null;
    return this.values[this.values.length - 1];
  }
  
  /**
   * Get the metadata for a specific timestamp
   */
  public getMetadata(key: string): any {
    return this.metadata.get(key);
  }
  
  /**
   * Get the latest metadata
   */
  public getLastMetadata(): any {
    if (this.values.length === 0) return null;
    const lastTimestamp = this.values.length - 1;
    return this.metadata.get(lastTimestamp.toString());
  }
  
  /**
   * Store custom metadata for the channel
   */
  public setMetadata(key: string, value: any): void {
    this.metadata.set(key, value);
  }
  
  /**
   * Get the channel name
   */
  public getName(): string {
    return this.name;
  }
  
  /**
   * Reset the channel to its initial state
   */
  public reset(): void {
    this.values = [];
    this.metadata.clear();
    this.qualityHistory = [];
    this.gain = 1.0;
    this.baseline = 0;
    console.log(`SignalChannel: Reset channel "${this.name}"`);
  }

  private calculateSignalQuality(): number {
    if (this.values.length < 2) return 100;

    // Calcular calidad basada en varios factores
    const amplitudeQuality = this.calculateAmplitudeQuality();
    const noiseQuality = this.calculateNoiseQuality();
    const stabilityQuality = this.calculateStabilityQuality();

    // Promedio ponderado de factores de calidad
    return Math.round(
      (amplitudeQuality * 0.4) +
      (noiseQuality * 0.3) +
      (stabilityQuality * 0.3)
    );
  }

  private calculateAmplitudeQuality(): number {
    const recentValues = this.values.slice(-30);
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const amplitude = max - min;
    
    // Normalizar a 0-100
    return Math.min(100, Math.max(0, amplitude * 100));
  }

  private calculateNoiseQuality(): number {
    const recentValues = this.values.slice(-30);
    let noiseLevel = 0;
    
    for (let i = 1; i < recentValues.length; i++) {
      noiseLevel += Math.abs(recentValues[i] - recentValues[i-1]);
    }
    
    noiseLevel /= (recentValues.length - 1);
    
    // Convertir a calidad (menos ruido = mayor calidad)
    return Math.min(100, Math.max(0, 100 - (noiseLevel * 100)));
  }

  private calculateStabilityQuality(): number {
    const recentValues = this.values.slice(-30);
    const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    let variance = 0;
    
    recentValues.forEach(value => {
      variance += Math.pow(value - mean, 2);
    });
    
    variance /= recentValues.length;
    
    // Convertir a calidad (menos varianza = mayor estabilidad)
    return Math.min(100, Math.max(0, 100 - (Math.sqrt(variance) * 50)));
  }

  private shouldOptimize(): boolean {
    if (this.qualityHistory.length < this.QUALITY_HISTORY_SIZE) {
      return false;
    }

    // Calcular tendencia de calidad
    const recentQuality = this.qualityHistory.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const oldQuality = this.qualityHistory.slice(0, 3).reduce((a, b) => a + b, 0) / 3;

    // Optimizar si la calidad está disminuyendo o es baja
    return recentQuality < oldQuality || recentQuality < 70;
  }

  private generateOptimizationSuggestions(): SignalFeedback['optimizationSuggestions'] {
    const suggestions: NonNullable<SignalFeedback['optimizationSuggestions']> = {};

    // Analizar señal reciente
    const recentValues = this.values.slice(-30);
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const amplitude = max - min;
    const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;

    // Sugerir ajustes de ganancia si la amplitud es muy baja o alta
    if (amplitude < 0.1) {
      suggestions.gainAdjustment = this.gain * 1.5;
    } else if (amplitude > 0.9) {
      suggestions.gainAdjustment = this.gain * 0.75;
    }

    // Sugerir corrección de línea base si la señal está descentrada
    if (Math.abs(mean) > 0.1) {
      suggestions.baselineCorrection = -mean;
    }

    // Sugerir ajustes de filtros basados en ruido
    const noiseLevel = this.calculateNoiseQuality();
    if (noiseLevel < 70) {
      suggestions.filters = {
        lowPass: this.config.filters?.lowPass ? this.config.filters.lowPass * 0.8 : 5,
        highPass: this.config.filters?.highPass ? this.config.filters.highPass * 1.2 : 0.5
      };
    }

    return suggestions;
  }

  public setGain(gain: number): void {
    this.gain = gain;
  }

  public setBaseline(baseline: number): void {
    this.baseline = baseline;
  }

  public trimHistory(maxLength: number): void {
    if (this.values.length <= maxLength) return;

    const excess = this.values.length - maxLength;
    this.values = this.values.slice(excess);
    
    // Actualizar metadata
    const newMetadata = new Map<string, ChannelMetadata>();
    this.metadata.forEach((value, key) => {
      if (!isNaN(parseInt(key)) && parseInt(key) >= excess) {
        newMetadata.set((parseInt(key) - excess).toString(), value);
      } else {
        newMetadata.set(key, value);
      }
    });
    this.metadata = newMetadata;
  }
}

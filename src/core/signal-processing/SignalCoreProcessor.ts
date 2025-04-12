/**
 * Central Signal Processing Module
 * Handles core signal processing functionality with separate channels for different vital signs
 */
import { SignalChannel } from './SignalChannel';
import { SignalFilter } from './filters/SignalFilter';
import { 
  SignalChannelConfig, 
  SignalFeedback, 
  SignalProcessorConfig,
  OptimizationLevel
} from './types';

export interface SignalProcessingConfig {
  bufferSize: number;
  sampleRate: number;
  channels: string[];
}

export interface SignalMetadata {
  quality: number;
  timestamp: number;
  timeDelta: number;
  rawValue: number;
  feedback?: SignalFeedback;
}

export class SignalCoreProcessor {
  private channels: Map<string, SignalChannel> = new Map();
  private rawBuffer: number[][] = [[], []];
  private filteredBuffer: number[][] = [[], []];
  private quality: number[] = [0, 0];
  private readonly bufferSize: number;
  private readonly filter: SignalFilter;
  private readonly sampleRate: number;
  private lastProcessTime: number = 0;
  
  // Nuevas propiedades para feedback bidireccional
  private channelFeedbackHistory: Map<string, SignalFeedback[]> = new Map();
  private crossChannelState: Map<string, {
    lastValue: number;
    trend: number;
    correlation: number;
    phase: number;
  }> = new Map();
  
  // Canales especializados
  private readonly CARDIAC_CHANNEL = 'cardiac';
  private readonly INDEPENDENT_CHANNELS = ['bloodPressure', 'spo2', 'glucose', 'temperature'];
  
  constructor(config: SignalProcessingConfig) {
    this.bufferSize = config.bufferSize || 300;
    this.sampleRate = config.sampleRate || 30;
    this.filter = new SignalFilter();
    
    // Inicializar historiales de feedback y estado de canales
    [this.CARDIAC_CHANNEL, ...this.INDEPENDENT_CHANNELS].forEach(channel => {
      this.channelFeedbackHistory.set(channel, []);
      this.crossChannelState.set(channel, {
        lastValue: 0,
        trend: 0,
        correlation: 0,
        phase: 0
      });
    });
    
    // Crear canales
    this.initializeChannels(config);
  }

  private initializeChannels(config: SignalProcessingConfig): void {
    // Crear canal cardíaco unificado
    this.createChannel(this.CARDIAC_CHANNEL, {
      bufferSize: this.bufferSize,
      sampleRate: this.sampleRate,
      feedbackEnabled: true,
      optimizationLevel: 'high'
    });

    // Crear canales independientes
    this.INDEPENDENT_CHANNELS.forEach(channel => {
      this.createChannel(channel, {
        bufferSize: this.bufferSize,
        sampleRate: this.sampleRate,
        feedbackEnabled: true,
        optimizationLevel: 'medium'
      });
    });
  }

  /**
   * Procesa el feedback bidireccional entre canales
   */
  private processBidirectionalFeedback(channelName: string, value: number): SignalFeedback {
    const state = this.crossChannelState.get(channelName);
    const history = this.channelFeedbackHistory.get(channelName);
    
    if (!state || !history) {
      return {
        quality: 50,
        needsOptimization: false,
        optimizationSuggestions: {
          gainAdjustment: 1,
          baselineCorrection: 0
        }
      };
    }

    // Calcular tendencia
    const trend = value - state.lastValue;
    
    // Actualizar correlación con otros canales
    let totalCorrelation = 0;
    let channelCount = 0;
    
    this.channels.forEach((otherChannel, otherName) => {
      if (otherName !== channelName) {
        const otherState = this.crossChannelState.get(otherName);
        if (otherState) {
          const correlation = this.calculateChannelCorrelation(
            channelName,
            otherName,
            value,
            otherState.lastValue
          );
          totalCorrelation += correlation;
          channelCount++;
        }
      }
    });

    // Actualizar estado del canal
    const newState = {
      lastValue: value,
      trend: trend,
      correlation: channelCount > 0 ? totalCorrelation / channelCount : 0,
      phase: this.calculatePhase(value, state.lastValue, this.sampleRate)
    };
    this.crossChannelState.set(channelName, newState);

    // Generar feedback basado en el análisis
    const feedback = this.generateBidirectionalFeedback(
      channelName,
      newState,
      history
    );

    // Actualizar historial
    history.push(feedback);
    if (history.length > this.bufferSize) {
      history.shift();
    }

    return feedback;
  }

  /**
   * Calcula la correlación entre dos canales
   */
  private calculateChannelCorrelation(
    channel1: string,
    channel2: string,
    value1: number,
    value2: number
  ): number {
    const state1 = this.crossChannelState.get(channel1);
    const state2 = this.crossChannelState.get(channel2);
    
    if (!state1 || !state2) return 0;

    // Calcular correlación usando tendencias y fases
    const trendCorrelation = Math.sign(state1.trend) === Math.sign(state2.trend) ? 1 : -1;
    const phaseCorrelation = Math.cos(state1.phase - state2.phase);
    
    return (trendCorrelation + phaseCorrelation) / 2;
  }

  /**
   * Calcula la fase de la señal
   */
  private calculatePhase(currentValue: number, lastValue: number, sampleRate: number): number {
    const dt = 1 / sampleRate;
    return Math.atan2(currentValue - lastValue, dt);
  }

  /**
   * Genera feedback bidireccional basado en el análisis
   */
  private generateBidirectionalFeedback(
    channelName: string,
    state: { lastValue: number; trend: number; correlation: number; phase: number },
    history: SignalFeedback[]
  ): SignalFeedback {
    // Analizar la calidad basada en la correlación
    const correlationQuality = Math.abs(state.correlation) * 100;
    
    // Analizar la estabilidad de la tendencia
    const trendStability = this.analyzeTrendStability(history);
    
    // Determinar si se necesita ajuste
    const needsOptimization = correlationQuality < 50 || trendStability < 0.5;
    
    // Calcular factor de ajuste
    const adjustmentFactor = this.calculateAdjustmentFactor(
      state.correlation,
      trendStability
    );

    return {
      quality: Math.round((correlationQuality + trendStability * 100) / 2),
      needsOptimization,
      optimizationSuggestions: {
        gainAdjustment: adjustmentFactor,
        baselineCorrection: needsOptimization ? state.trend : 0
      }
    };
  }

  /**
   * Analiza la estabilidad de la tendencia
   */
  private analyzeTrendStability(history: SignalFeedback[]): number {
    if (history.length < 2) return 1;
    
    let stabilityScore = 0;
    let totalComparisons = 0;
    
    for (let i = 1; i < history.length; i++) {
      const prevQuality = history[i - 1].quality;
      const currentQuality = history[i].quality;
      
      const qualityDiff = Math.abs(currentQuality - prevQuality);
      stabilityScore += Math.exp(-qualityDiff / 20); // Función exponencial para penalizar grandes cambios
      totalComparisons++;
    }
    
    return totalComparisons > 0 ? stabilityScore / totalComparisons : 1;
  }

  /**
   * Calcula el factor de ajuste basado en correlación y estabilidad
   */
  private calculateAdjustmentFactor(correlation: number, stability: number): number {
    // Usar una función sigmoide para suavizar el factor de ajuste
    const x = (correlation + stability) / 2;
    const sigmoid = 1 / (1 + Math.exp(-10 * (x - 0.5)));
    
    // Mapear a un rango de ajuste razonable [0.5, 1.5]
    return 0.5 + sigmoid;
  }

  /**
   * Procesa una señal con feedback bidireccional
   */
  public processSignal(value: number): Map<string, SignalChannel> {
    const currentTime = Date.now();
    const timeDelta = this.lastProcessTime ? currentTime - this.lastProcessTime : 0;
    this.lastProcessTime = currentTime;

    // 1. Procesar canal cardíaco con feedback bidireccional
    const cardiacChannel = this.channels.get(this.CARDIAC_CHANNEL);
    if (cardiacChannel) {
      const processedCardiac = this.processCardiacSignal(value);
      const cardiacFeedback = this.processBidirectionalFeedback(this.CARDIAC_CHANNEL, processedCardiac);
      
      const cardiacMetadata: SignalMetadata = {
        quality: this.calculateCardiacQuality(processedCardiac),
        timestamp: currentTime,
        timeDelta,
        rawValue: value,
        feedback: cardiacFeedback
      };

      cardiacChannel.addValue(processedCardiac, cardiacMetadata);
    }

    // 2. Procesar canales independientes con feedback bidireccional
    this.INDEPENDENT_CHANNELS.forEach(channelName => {
      const channel = this.channels.get(channelName);
      if (!channel) return;

      const processedValue = this.processChannelSpecific(channelName, value);
      const channelFeedback = this.processBidirectionalFeedback(channelName, processedValue);
      
      const channelMetadata: SignalMetadata = {
        quality: this.calculateChannelQuality(channelName, processedValue),
        timestamp: currentTime,
        timeDelta,
        rawValue: value,
        feedback: channelFeedback
      };

      channel.addValue(processedValue, channelMetadata);
    });

    return this.channels;
  }
  
  /**
   * Create a new signal processing channel
   */
  public createChannel(channelName: string, options?: SignalChannelConfig): SignalChannel {
    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!;
    }
    
    const channel = new SignalChannel(channelName, this.bufferSize);
    this.channels.set(channelName, channel);
    return channel;
  }
  
  /**
   * Process a raw PPG signal
   * Core method that applies filtering and distributes to channels
   */
  public processCardiacSignal(value: number): number {
    // Add to raw buffer
    this.rawBuffer[0].push(value);
    if (this.rawBuffer[0].length > this.bufferSize) {
      this.rawBuffer[0].shift();
    }
    
    // Apply common filtering
    const filtered = this.applyFilters(value);
    
    // Add to filtered buffer
    this.filteredBuffer[0].push(filtered);
    if (this.filteredBuffer[0].length > this.bufferSize) {
      this.filteredBuffer[0].shift();
    }
    
    // Calculate signal quality
    const quality = this.calculateSignalQuality(filtered);
    
    // Update channel
    const cardiacChannel = this.channels.get(this.CARDIAC_CHANNEL);
    if (cardiacChannel) {
      cardiacChannel.addValue(filtered, {
        quality,
        timestamp: Date.now(),
        timeDelta: 0,
        rawValue: value
      });
    }
    
    return filtered;
  }
  
  /**
   * Apply multiple filtering techniques to the signal
   */
  private applyFilters(value: number): number {
    return this.filter.applyFilters(value, this.rawBuffer[0]);
  }
  
  /**
   * Calculate signal quality from 0-100
   */
  private calculateSignalQuality(value: number): number {
    if (this.filteredBuffer[0].length < 10) return 0;
    
    // Basic quality calculation
    const recentValues = this.filteredBuffer[0].slice(-10);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const range = max - min;
    
    // Calculate noise level
    let noiseLevel = 0;
    for (let i = 1; i < recentValues.length; i++) {
      noiseLevel += Math.abs(recentValues[i] - recentValues[i-1]);
    }
    noiseLevel /= (recentValues.length - 1);
    
    // Signal-to-noise ratio based quality
    const signalToNoise = range / (noiseLevel || 0.001);
    
    // Convert to 0-100 scale
    return Math.min(100, Math.max(0, signalToNoise * 20));
  }
  
  /**
   * Get a specific channel by name
   */
  public getChannel(channelName: string): SignalChannel | undefined {
    return this.channels.get(channelName);
  }
  
  /**
   * Get all raw buffer values
   */
  public getRawBuffer(): number[] {
    return [...this.rawBuffer[0]];
  }
  
  /**
   * Get all filtered buffer values
   */
  public getFilteredBuffer(): number[] {
    return [...this.filteredBuffer[0]];
  }
  
  /**
   * Reset all buffers and channels
   */
  public reset(): void {
    this.rawBuffer = [[], []];
    this.filteredBuffer = [[], []];
    this.lastProcessTime = 0;
    
    this.channels.forEach(channel => {
      channel.reset();
    });
    
    console.log("SignalCoreProcessor: Reset complete");
  }

  /**
   * Calcula la calidad de la señal cardíaca
   */
  private calculateCardiacQuality(value: number): number {
    const cardiacChannel = this.channels.get(this.CARDIAC_CHANNEL);
    if (!cardiacChannel) return 0;

    const values = cardiacChannel.getValues();
    if (values.length < 10) return 50;

    // Calcular calidad basada en múltiples factores
    const amplitudeQuality = this.calculateAmplitudeQuality(values);
    const rhythmQuality = this.calculateRhythmQuality(values);
    const noiseQuality = this.calculateNoiseQuality(values);

    return Math.round((amplitudeQuality + rhythmQuality + noiseQuality) / 3);
  }

  /**
   * Calcula la calidad específica del canal
   */
  private calculateChannelQuality(channelName: string, value: number): number {
    const channel = this.channels.get(channelName);
    if (!channel) return 0;

    const values = channel.getValues();
    if (values.length < 10) return 50;

    // Calcular calidad específica del canal
    switch (channelName) {
      case 'bloodPressure':
        return this.calculateBPQuality(values);
      case 'spo2':
        return this.calculateSPO2Quality(values);
      case 'glucose':
        return this.calculateGlucoseQuality(values);
      case 'temperature':
        return this.calculateTemperatureQuality(values);
      default:
        return 50;
    }
  }

  /**
   * Procesa una señal específica del canal
   */
  private processChannelSpecific(channelName: string, value: number): number {
    switch (channelName) {
      case 'bloodPressure':
        return this.processBPSignal(value);
      case 'spo2':
        return this.processSPO2Signal(value);
      case 'glucose':
        return this.processGlucoseSignal(value);
      case 'temperature':
        return this.processTemperatureSignal(value);
      default:
        return value;
    }
  }

  /**
   * Calcula la calidad de la señal de presión arterial
   */
  private calculateBPQuality(values: number[]): number {
    if (values.length < 10) return 50;
    return this.calculateSignalQuality(values[values.length - 1]);
  }

  /**
   * Calcula la calidad de la señal de SpO2
   */
  private calculateSPO2Quality(values: number[]): number {
    if (values.length < 10) return 50;
    return this.calculateSignalQuality(values[values.length - 1]);
  }

  /**
   * Calcula la calidad de la señal de glucosa
   */
  private calculateGlucoseQuality(values: number[]): number {
    if (values.length < 10) return 50;
    return this.calculateSignalQuality(values[values.length - 1]);
  }

  /**
   * Calcula la calidad de la señal de temperatura
   */
  private calculateTemperatureQuality(values: number[]): number {
    if (values.length < 10) return 50;
    return this.calculateSignalQuality(values[values.length - 1]);
  }

  /**
   * Calcula la calidad de amplitud de la señal
   */
  private calculateAmplitudeQuality(values: number[]): number {
    if (values.length < 10) return 50;
    
    const recentValues = values.slice(-10);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    // Normalizar a un rango de 0-100
    return Math.min(100, Math.max(0, amplitude * 100));
  }

  /**
   * Calcula la calidad del ritmo de la señal
   */
  private calculateRhythmQuality(values: number[]): number {
    if (values.length < 20) return 50;
    
    const recentValues = values.slice(-20);
    let rhythmScore = 0;
    
    // Analizar regularidad del ritmo
    for (let i = 1; i < recentValues.length; i++) {
      const diff = Math.abs(recentValues[i] - recentValues[i-1]);
      rhythmScore += Math.exp(-diff);
    }
    
    return Math.min(100, Math.max(0, (rhythmScore / (recentValues.length - 1)) * 100));
  }

  /**
   * Calcula la calidad basada en el ruido de la señal
   */
  private calculateNoiseQuality(values: number[]): number {
    if (values.length < 10) return 50;
    
    const recentValues = values.slice(-10);
    const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    
    // Calcular desviación estándar
    const variance = recentValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentValues.length;
    const std = Math.sqrt(variance);
    
    // Convertir a calidad (menor ruido = mayor calidad)
    return Math.min(100, Math.max(0, 100 - (std * 100)));
  }

  /**
   * Procesa la señal de presión arterial
   */
  private processBPSignal(value: number): number {
    // Aplicar filtro específico para presión arterial
    const buffer = this.rawBuffer[0];
    return this.filter.applyFilters(value, buffer);
  }

  /**
   * Procesa la señal de SpO2
   */
  private processSPO2Signal(value: number): number {
    // Aplicar filtro específico para SpO2
    const buffer = this.rawBuffer[0];
    return this.filter.applyFilters(value, buffer);
  }

  /**
   * Procesa la señal de glucosa
   */
  private processGlucoseSignal(value: number): number {
    // Aplicar filtro específico para glucosa
    const buffer = this.rawBuffer[0];
    return this.filter.applyFilters(value, buffer);
  }

  /**
   * Procesa la señal de temperatura
   */
  private processTemperatureSignal(value: number): number {
    // Aplicar filtro específico para temperatura
    const buffer = this.rawBuffer[0];
    return this.filter.applyFilters(value, buffer);
  }
}

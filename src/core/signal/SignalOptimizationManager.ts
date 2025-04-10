
import { AdaptiveOptimizer, OptimizedChannel } from './AdaptiveOptimizer';
import { ProcessorConfig, DEFAULT_PROCESSOR_CONFIG } from '../config/ProcessorConfig';
import { ProcessedSignal } from '../types';

/**
 * Interfaz para resultados de optimización de señal
 */
export interface OptimizationResult {
  heartRate: {
    value: number;
    confidence: number;
  };
  optimizedChannels: Map<string, OptimizedChannel>;
  signalQuality: number;
  isDominantFrequencyValid: boolean;
  dominantFrequency: number;
}

/**
 * Gestor de optimización de señales
 * 
 * Coordina el procesamiento entre diferentes canales optimizados
 * y proporciona una interfaz unificada para los componentes de nivel superior
 */
export class SignalOptimizationManager {
  private optimizer: AdaptiveOptimizer;
  private lastOptimizationResult: OptimizationResult | null = null;
  private signalBuffer: number[] = [];
  private readonly bufferMaxSize: number = 300;
  
  // Estado de latido cardíaco
  private lastHeartRateBpm: number = 0;
  private lastConfidence: number = 0;
  private heartRateBuffer: number[] = [];
  private readonly HR_BUFFER_SIZE = 5;
  
  // Umbrales de calidad
  private readonly QUALITY_THRESHOLD_LOW = 30;
  private readonly QUALITY_THRESHOLD_MEDIUM = 60;
  private readonly QUALITY_THRESHOLD_HIGH = 80;
  
  /**
   * Constructor del gestor de optimización
   */
  constructor(config: ProcessorConfig = DEFAULT_PROCESSOR_CONFIG) {
    this.optimizer = new AdaptiveOptimizer(config);
  }
  
  /**
   * Procesa una nueva señal y devuelve resultado optimizado
   */
  public processSignal(signal: ProcessedSignal): OptimizationResult {
    // Extraer valor filtrado de la señal
    const { filteredValue, quality } = signal;
    
    // Almacenar en buffer
    this.signalBuffer.push(filteredValue);
    if (this.signalBuffer.length > this.bufferMaxSize) {
      this.signalBuffer.shift();
    }
    
    // Procesar con optimizador adaptativo
    const optimizedChannels = this.optimizer.processValue(filteredValue);
    
    // Verificar canal de frecuencia cardíaca
    const heartRateChannel = optimizedChannels.get('heartRate');
    
    // Calcular frecuencia cardíaca si hay suficientes datos
    let heartRate = this.lastHeartRateBpm;
    let confidence = this.lastConfidence;
    let dominantFrequency = 0;
    let isDominantFrequencyValid = false;
    
    if (heartRateChannel && heartRateChannel.values.length > 60) {
      // Obtener frecuencia dominante del canal
      dominantFrequency = heartRateChannel.metadata.dominantFrequency;
      
      // Convertir frecuencia a BPM
      if (dominantFrequency > 0.5 && dominantFrequency < 3.5) {
        const bpm = dominantFrequency * 60;
        isDominantFrequencyValid = true;
        
        // Verificar que esté en rango fisiológico
        if (bpm >= 40 && bpm <= 200) {
          // Almacenar en buffer de frecuencia
          this.heartRateBuffer.push(bpm);
          if (this.heartRateBuffer.length > this.HR_BUFFER_SIZE) {
            this.heartRateBuffer.shift();
          }
          
          // Calcular promedio ponderado
          let weightedSum = 0;
          let weightSum = 0;
          
          for (let i = 0; i < this.heartRateBuffer.length; i++) {
            const weight = (i + 1); // Dar más peso a valores recientes
            weightedSum += this.heartRateBuffer[i] * weight;
            weightSum += weight;
          }
          
          heartRate = Math.round(weightedSum / weightSum);
          
          // Calcular confianza basada en calidad de canal y score de periodicidad
          confidence = Math.min(1, 
            (heartRateChannel.quality / 100) * 0.6 + 
            heartRateChannel.metadata.periodicityScore * 0.4
          );
          
          // Actualizar valores de estado
          this.lastHeartRateBpm = heartRate;
          this.lastConfidence = confidence;
        }
      }
    }
    
    // Calcular calidad general
    const signalQuality = this.optimizer.getSignalQuality();
    
    // Proporcionar feedback al optimizador
    this.provideFeedbackToOptimizer(optimizedChannels, heartRate, confidence);
    
    // Construir resultado de optimización
    const result: OptimizationResult = {
      heartRate: {
        value: heartRate,
        confidence: confidence
      },
      optimizedChannels,
      signalQuality,
      dominantFrequency,
      isDominantFrequencyValid
    };
    
    // Almacenar resultado
    this.lastOptimizationResult = result;
    
    return result;
  }
  
  /**
   * Proporciona feedback al optimizador para mejorar futuros procesamiento
   */
  private provideFeedbackToOptimizer(
    channels: Map<string, OptimizedChannel>,
    heartRate: number,
    confidence: number
  ): void {
    // Feedback para canal de frecuencia cardíaca
    if (channels.has('heartRate')) {
      const hrQuality = channels.get('heartRate')!.quality;
      
      // Proporcionar métrica de precisión basada en estabilidad
      let accuracy = 0;
      
      if (this.heartRateBuffer.length >= 3) {
        // Calcular desviación estándar
        const mean = this.heartRateBuffer.reduce((sum, hr) => sum + hr, 0) / this.heartRateBuffer.length;
        const variance = this.heartRateBuffer.reduce((sum, hr) => sum + Math.pow(hr - mean, 2), 0) / 
                        this.heartRateBuffer.length;
        const stdDev = Math.sqrt(variance);
        
        // Alta precisión = baja desviación estándar relativa
        accuracy = Math.max(0, Math.min(1, 1 - (stdDev / mean) / 0.1));
      }
      
      this.optimizer.provideFeedback('heartRate', {
        accuracy,
        confidence,
        errorRate: 1 - confidence
      });
    }
    
    // Feedback para otros canales basado en rendimiento de canal de ritmo cardíaco
    // (ya que es el canal de referencia para validación)
    if (confidence > 0.7) {
      for (const [channelName, _] of channels.entries()) {
        if (channelName !== 'heartRate') {
          this.optimizer.provideFeedback(channelName, {
            confidence: confidence * 0.8,
            accuracy: confidence * 0.7
          });
        }
      }
    }
  }
  
  /**
   * Obtiene el último resultado de optimización
   */
  public getLastResult(): OptimizationResult | null {
    return this.lastOptimizationResult;
  }
  
  /**
   * Obtiene valores de un canal específico
   */
  public getChannelValues(channelName: string): number[] {
    return this.optimizer.getChannelValues(channelName);
  }
  
  /**
   * Obtiene canal completo con metadatos
   */
  public getChannel(channelName: string): OptimizedChannel | undefined {
    return this.optimizer.getChannel(channelName);
  }
  
  /**
   * Restablece estado del optimizador
   */
  public reset(): void {
    this.optimizer.reset();
    this.signalBuffer = [];
    this.lastHeartRateBpm = 0;
    this.lastConfidence = 0;
    this.heartRateBuffer = [];
    this.lastOptimizationResult = null;
  }
  
  /**
   * Actualiza configuración
   */
  public updateConfig(config: Partial<ProcessorConfig>): void {
    this.optimizer.setConfig(config);
  }
}

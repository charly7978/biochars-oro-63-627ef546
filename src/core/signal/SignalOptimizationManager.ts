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
  
  private errorCount: Map<string, number> = new Map();
  private readonly MAX_ERRORS = 3;
  private readonly ERROR_RESET_INTERVAL = 60000; // 1 minuto
  
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
    try {
      // Validación robusta de entrada
      if (!signal || typeof signal.value !== 'number' || typeof signal.filteredValue !== 'number') {
        throw new Error('Señal inválida o incompleta');
      }

      // Validar rangos fisiológicos
      if (signal.value < -1000 || signal.value > 1000) {
        throw new Error('Valor de señal fuera de rango fisiológico');
      }

      // Verificar inicialización
      if (!this.optimizer) {
        console.warn('Optimizador no inicializado, creando nueva instancia');
        this.optimizer = new AdaptiveOptimizer(DEFAULT_PROCESSOR_CONFIG);
      }

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
    } catch (error) {
      console.error('Error en processSignal:', error);
      // Devolver resultado seguro por defecto
      return {
        heartRate: { value: 0, confidence: 0 },
        optimizedChannels: new Map(),
        signalQuality: 0,
        isDominantFrequencyValid: false,
        dominantFrequency: 0
      };
    }
  }
  
  /**
   * Proporciona feedback al optimizador para mejorar futuros procesamientos
   */
  private provideFeedbackToOptimizer(
    channels: Map<string, OptimizedChannel>,
    heartRate: number,
    confidence: number
  ): void {
    try {
      // Validar entradas
      if (!channels || channels.size === 0) {
        console.warn('SignalOptimizationManager: No hay canales disponibles para feedback');
        return;
      }

      // Feedback para canal de frecuencia cardíaca
      if (channels.has('heartRate')) {
        const hrChannel = channels.get('heartRate')!;
        const hrQuality = hrChannel.quality;
        
        // Calcular precisión basada en estabilidad y calidad
        let accuracy = 0;
        
        if (this.heartRateBuffer.length >= 3) {
          // Calcular estadísticas mejoradas
          const values = this.heartRateBuffer;
          const mean = values.reduce((sum, hr) => sum + hr, 0) / values.length;
          const variance = values.reduce((sum, hr) => sum + Math.pow(hr - mean, 2), 0) / values.length;
          const stdDev = Math.sqrt(variance);
          
          // Precisión basada en múltiples factores
          const stabilityScore = Math.max(0, Math.min(1, 1 - (stdDev / mean) / 0.1));
          const qualityScore = hrQuality / 100;
          
          // Combinar scores con pesos
          accuracy = (stabilityScore * 0.6) + (qualityScore * 0.4);
        }

        // Proporcionar feedback detallado al canal de frecuencia cardíaca
        this.optimizer.provideFeedback('heartRate', {
          accuracy,
          confidence,
          errorRate: 1 - confidence,
          responseTime: Date.now() - hrChannel.metadata.lastUpdateTime || 0
        });

        // Actualizar otros canales solo si tenemos buena confianza
        if (confidence > 0.7 && accuracy > 0.6) {
          for (const [channelName, channel] of channels.entries()) {
            if (channelName !== 'heartRate') {
              // Calcular confianza específica para cada canal
              const channelConfidence = this.calculateChannelConfidence(
                channel,
                confidence,
                accuracy
              );

              this.optimizer.provideFeedback(channelName, {
                confidence: channelConfidence,
                accuracy: accuracy * 0.9, // Ligeramente menor que HR
                responseTime: Date.now() - channel.metadata.lastUpdateTime || 0
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error en provideFeedbackToOptimizer:', error);
      // No propagar el error para evitar interrumpir el procesamiento
    }
  }
  
  /**
   * Calcula la confianza específica para cada canal
   */
  private calculateChannelConfidence(
    channel: OptimizedChannel,
    baseConfidence: number,
    baseAccuracy: number
  ): number {
    const qualityFactor = channel.quality / 100;
    const periodicityFactor = channel.metadata.periodicityScore;
    const snrFactor = Math.min(1, channel.metadata.snr / 20);

    return Math.min(1, (
      baseConfidence * 0.4 +
      qualityFactor * 0.2 +
      periodicityFactor * 0.2 +
      snrFactor * 0.2
    ));
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

  private handleChannelError(channelName: string, error: Error): void {
    const currentErrors = (this.errorCount.get(channelName) || 0) + 1;
    this.errorCount.set(channelName, currentErrors);

    console.error(`Error en canal ${channelName}:`, error);

    if (currentErrors >= this.MAX_ERRORS) {
      console.warn(`Canal ${channelName} reiniciado por errores múltiples`);
      this.optimizer.recoverFromError(channelName);
      this.errorCount.set(channelName, 0);
    }

    // Reiniciar contadores de error periódicamente
    setTimeout(() => {
      this.errorCount.set(channelName, 0);
    }, this.ERROR_RESET_INTERVAL);
  }
}

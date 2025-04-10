
import { OptimizedChannel } from './OptimizedChannel';

/**
 * Adaptador de optimización que maneja varios canales de señal y los optimiza
 * según feedback y análisis en tiempo real.
 */
export class AdaptiveOptimizer {
  private channels: Map<string, OptimizedChannel> = new Map();
  private config: any = {};

  constructor(config: any = {}) {
    this.config = config;
    this.initializeDefaultChannels();
  }

  private initializeDefaultChannels() {
    // Canal para frecuencia cardíaca
    this.channels.set('heartRate', {
      values: [],
      quality: 0,
      metadata: {
        dominantFrequency: 0,
        periodicityScore: 0,
        noiseLevel: 0
      }
    });
  }

  public processValue(value: number): Map<string, OptimizedChannel> {
    // Procesar valor para todos los canales
    for (const [channelName, channel] of this.channels.entries()) {
      // Almacenar valor
      channel.values.push(value);
      
      // Limitar tamaño del buffer
      if (channel.values.length > 300) {
        channel.values.shift();
      }
      
      // Actualizar calidad basada en análisis simple
      if (channel.values.length > 30) {
        channel.quality = this.calculateChannelQuality(channel.values);
        
        // Actualizar metadatos
        channel.metadata = {
          ...channel.metadata,
          dominantFrequency: this.estimateDominantFrequency(channel.values),
          periodicityScore: this.calculatePeriodicityScore(channel.values),
          noiseLevel: this.estimateNoiseLevel(channel.values)
        };
      }
    }
    
    return this.channels;
  }

  public getSignalQuality(): number {
    // Promedio de calidad de todos los canales
    let totalQuality = 0;
    let channelCount = 0;
    
    for (const channel of this.channels.values()) {
      totalQuality += channel.quality;
      channelCount++;
    }
    
    return channelCount > 0 ? totalQuality / channelCount : 0;
  }

  public provideFeedback(channelName: string, metrics: any): void {
    const channel = this.channels.get(channelName);
    if (!channel) return;
    
    // Ajustar calidad basada en feedback
    if (metrics.accuracy !== undefined) {
      channel.quality = (channel.quality * 0.7) + (metrics.accuracy * 100 * 0.3);
    }
  }

  public getChannelValues(channelName: string): number[] {
    const channel = this.channels.get(channelName);
    return channel ? [...channel.values] : [];
  }

  public getChannel(channelName: string): OptimizedChannel | undefined {
    return this.channels.get(channelName);
  }

  public reset(): void {
    for (const channel of this.channels.values()) {
      channel.values = [];
      channel.quality = 0;
      channel.metadata = {
        dominantFrequency: 0,
        periodicityScore: 0,
        noiseLevel: 0
      };
    }
  }

  public setConfig(config: any): void {
    this.config = {...this.config, ...config};
  }

  private calculateChannelQuality(values: number[]): number {
    if (values.length < 10) return 0;
    
    // Calcular variación simple
    const recentValues = values.slice(-30);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const range = max - min;
    
    // Calcular desviación estándar
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentValues.length;
    const stdDev = Math.sqrt(variance);
    
    // Calcular relación señal/ruido estimada
    const snr = range > 0 ? mean / stdDev : 0;
    
    // Convertir a calidad (0-100)
    const quality = Math.min(100, Math.max(0, snr * 10));
    
    return quality;
  }

  private estimateDominantFrequency(values: number[]): number {
    if (values.length < 60) return 0;
    
    // Implementación simplificada
    const recentValues = values.slice(-60);
    
    // Detectar cruces por cero para estimar periodicidad
    let crossings = 0;
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    for (let i = 1; i < recentValues.length; i++) {
      if ((recentValues[i-1] < mean && recentValues[i] >= mean) ||
          (recentValues[i-1] >= mean && recentValues[i] < mean)) {
        crossings++;
      }
    }
    
    // Estimar frecuencia (Hz)
    // Asumiendo frecuencia de muestreo de 30Hz
    const samplingRate = 30;
    const seconds = recentValues.length / samplingRate;
    const frequency = crossings / 2 / seconds;
    
    return frequency;
  }

  private calculatePeriodicityScore(values: number[]): number {
    if (values.length < 60) return 0.5;
    
    const recentValues = values.slice(-60);
    
    // Análisis de autocorrelación simple
    const halfSize = Math.floor(recentValues.length / 2);
    let maxCorrelation = 0;
    
    for (let lag = 10; lag < halfSize; lag++) {
      let correlation = 0;
      let count = 0;
      
      for (let i = 0; i < halfSize; i++) {
        correlation += recentValues[i] * recentValues[i + lag];
        count++;
      }
      
      correlation = count > 0 ? correlation / count : 0;
      maxCorrelation = Math.max(maxCorrelation, correlation);
    }
    
    // Normalizar a 0-1
    return Math.min(1, Math.max(0, maxCorrelation / 100));
  }

  private estimateNoiseLevel(values: number[]): number {
    if (values.length < 20) return 0;
    
    const recentValues = values.slice(-20);
    
    // Calcular diferencias entre puntos adyacentes
    const diffs = [];
    for (let i = 1; i < recentValues.length; i++) {
      diffs.push(Math.abs(recentValues[i] - recentValues[i-1]));
    }
    
    // Promedio de diferencias como estimación de ruido
    const avgDiff = diffs.reduce((sum, val) => sum + val, 0) / diffs.length;
    
    return avgDiff;
  }

  // Método para recuperar de errores
  public recoverFromError(): void {
    // Reiniciar canales con problemas
    for (const [channelName, channel] of this.channels.entries()) {
      if (channel.values.length > 100) {
        // Mantener solo los últimos 60 valores
        channel.values = channel.values.slice(-60);
      }
      
      // Reiniciar calidad si es muy baja
      if (channel.quality < 10) {
        channel.quality = 30; // Valor base
      }
    }
  }
}

// Asegurar que se exporte OptimizedChannel
export interface OptimizedChannel {
  values: number[];
  quality: number;
  metadata: {
    dominantFrequency: number;
    periodicityScore: number;
    noiseLevel: number;
    [key: string]: any;
  };
}

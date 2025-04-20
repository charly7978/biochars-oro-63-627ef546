import { SignalChannelOptimizer, ChannelFeedback, SignalChannelOptimizerParams } from './SignalChannelOptimizer';

/**
 * Manager de optimización de señales multicanal con feedback bidireccional
 * Permite integración con UI para intervención manual y feedback automático de los algoritmos de resultados
 */
export class SignalOptimizerManager {
  private channelOptimizers: Map<string, SignalChannelOptimizer> = new Map();
  private channelHistory: Map<string, { quality: number, confidence: number }[]> = new Map();
  private readonly MAX_HISTORY_SIZE = 10;

  /** Inicializa canales con parámetros opcionales */
  constructor(channelConfigs: Record<string, Partial<SignalChannelOptimizerParams>> = {}) {
    // Configuración óptima por defecto para cada canal
    const defaultConfig: Record<string, Partial<SignalChannelOptimizerParams>> = {
      red: { 
        filterType: 'bandpass',  // El mejor para señal PPG basada en rojo
        gain: 1.8,
        bandpassLowCut: 0.5,    // ~30 BPM
        bandpassHighCut: 4.0,    // ~240 BPM
        adaptiveMode: true
      },
      green: { 
        filterType: 'ema',      // EMA es más efectivo para canal verde
        gain: 1.2,
        emaAlpha: 0.7
      },
      blue: { 
        filterType: 'kalman',   // Kalman para señal más ruidosa
        gain: 0.8,
        kalmanQ: 0.15,
        kalmanR: 0.1
      },
      ir: { 
        filterType: 'wavelet',  // Mejor para infrarrojo
        gain: 2.0,
        adaptiveMode: true
      }
    };
    
    // Inicializar canales mezclando configuración predeterminada y personalizada
    for (const channel of [...Object.keys(defaultConfig), ...Object.keys(channelConfigs)]) {
      const mergedConfig = {
        ...defaultConfig[channel] || {},
        ...channelConfigs[channel] || {}
      };
      
      this.channelOptimizers.set(channel, new SignalChannelOptimizer(mergedConfig));
      this.channelHistory.set(channel, []);
    }
    
    console.log("SignalOptimizerManager: Inicializado con configuración optimizada por canal");
  }

  /** Procesa un valor por canal y devuelve la señal optimizada */
  public process(channel: string, value: number): number {
    if (!this.channelOptimizers.has(channel)) {
      // Si es un canal nuevo, configurar según su nombre
      const config = this.getDefaultConfigForChannel(channel);
      this.channelOptimizers.set(channel, new SignalChannelOptimizer(config));
      this.channelHistory.set(channel, []);
    }
    return this.channelOptimizers.get(channel)!.process(value);
  }

  /** Obtiene configuración óptima basada en el nombre del canal */
  private getDefaultConfigForChannel(channel: string): Partial<SignalChannelOptimizerParams> {
    // Inteligencia para determinar canal por nombre
    if (channel.includes('red') || channel === 'r') {
      return { 
        filterType: 'bandpass', 
        gain: 1.8,
        bandpassLowCut: 0.5,  // ~30 BPM
        bandpassHighCut: 4.0,  // ~240 BPM
        adaptiveMode: true
      };
    } else if (channel.includes('green') || channel === 'g') {
      return { 
        filterType: 'ema', 
        gain: 1.2,
        emaAlpha: 0.7 
      };
    } else if (channel.includes('blue') || channel === 'b') {
      return { 
        filterType: 'kalman', 
        gain: 0.8,
        kalmanQ: 0.15,
        kalmanR: 0.1
      };
    } else if (channel.includes('ir') || channel.includes('infrared')) {
      return { 
        filterType: 'wavelet', 
        gain: 2.0,
        adaptiveMode: true
      };
    }
    
    // Configuración genérica para canales desconocidos
    return { 
      filterType: 'kalman', 
      gain: 1.5
    };
  }

  /** Aplica feedback a un canal específico */
  public applyFeedback(channel: string, feedback: ChannelFeedback): void {
    if (!this.channelOptimizers.has(channel)) return;
    
    // Guardar historial de calidad por canal
    const history = this.channelHistory.get(channel)!;
    history.push({
      quality: feedback.quality,
      confidence: feedback.confidence
    });
    
    // Mantener tamaño de historial acotado
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.shift();
    }
    
    // Ajuste automático de parámetros según confianza y calidad
    const optimizer = this.channelOptimizers.get(channel)!;
    const currentParams = optimizer.getParams();
    
    // Ajustes específicos para diferentes métricas
    switch (feedback.metricType) {
      case 'HR': 
        // Para ritmo cardíaco, optimizar para frecuencias específicas
        if (feedback.confidence < 0.6) {
          const newParams: Partial<SignalChannelOptimizerParams> = {};
          
          // Si el canal es rojo, ajustar para mejor rendimiento cardíaco
          if (channel === 'red') {
            newParams.filterType = 'bandpass';
            newParams.bandpassLowCut = 0.5;  // 30 BPM
            newParams.bandpassHighCut = 3.3; // 200 BPM
            newParams.gain = Math.min(4.0, (currentParams.gain || 1.0) + 0.15);
          } else {
            newParams.gain = Math.min(4.0, (currentParams.gain || 1.0) + 0.15);
            if (currentParams.filterType !== 'kalman' && currentParams.filterType !== 'bandpass') {
              newParams.filterType = 'kalman';
            }
          }
          
          optimizer.setParams(newParams);
        } else if (feedback.confidence > 0.9) {
          // Si calidad es muy buena, reducir ganancia gradualmente
          optimizer.setParams({ 
            gain: Math.max(1.0, (currentParams.gain || 1.0) - 0.1)
          });
        }
        break;
        
      case 'SpO2':
        // SpO2 requiere buena relación entre canales rojo e IR
        if (channel === 'red' || channel === 'ir') {
          if (feedback.confidence < 0.7) {
            // Aumentar el contraste entre canales
            optimizer.setParams({ 
              filterType: 'wavelet',
              gain: Math.min(3.0, (currentParams.gain || 1.0) + 0.1)
            });
          }
        }
        break;
        
      default:
        // Comportamiento genérico
        if (feedback.confidence < 0.6) {
          optimizer.setParams({ 
            gain: Math.min(4.0, (currentParams.gain || 1.0) + 0.15)
          });
          
          // Cambiar a filtro más robusto si la confianza es baja
          if (currentParams.filterType !== 'kalman') {
            optimizer.setParams({ filterType: 'kalman' });
          }
        } else if (feedback.confidence > 0.9) {
          // Ganancia mínima 1.0
          optimizer.setParams({ 
            gain: Math.max(1.0, (currentParams.gain || 1.0) - 0.1)
          });
          
          // Si hay mucha confianza, usar filtro más rápido
          const evaluation = optimizer.evaluateFilterQuality();
          if (evaluation.quality > 0.7 && currentParams.filterType === 'kalman') {
            optimizer.setParams({ filterType: 'ema' });
          }
        }
    }
    
    // Aplicar feedback al optimizador de canal
    optimizer.applyFeedback(feedback);
  }

  /** Permite exponer los parámetros actuales de un canal para UI/manual */
  public getParams(channel: string): SignalChannelOptimizerParams | null {
    if (!this.channelOptimizers.has(channel)) return null;
    return this.channelOptimizers.get(channel)!.getParams();
  }

  /** Permite setear parámetros manualmente (UI) para un canal */
  public setParams(channel: string, newParams: Partial<SignalChannelOptimizerParams>): void {
    if (!this.channelOptimizers.has(channel)) {
      // Si el canal no existe, crearlo con los nuevos parámetros
      this.channelOptimizers.set(
        channel, 
        new SignalChannelOptimizer({
          ...this.getDefaultConfigForChannel(channel),
          ...newParams
        })
      );
      this.channelHistory.set(channel, []);
    } else {
      this.channelOptimizers.get(channel)!.setParams(newParams);
    }
  }

  /** Devuelve el último valor filtrado de un canal */
  public getLastFiltered(channel: string): number | null {
    if (!this.channelOptimizers.has(channel)) return null;
    return this.channelOptimizers.get(channel)!.getLastFiltered();
  }

  /** Devuelve el último valor crudo de un canal */
  public getLastRaw(channel: string): number | null {
    if (!this.channelOptimizers.has(channel)) return null;
    return this.channelOptimizers.get(channel)!.getLastRaw();
  }

  /** Devuelve los canales activos */
  public getChannels(): string[] {
    return Array.from(this.channelOptimizers.keys());
  }

  /** Devuelve estadísticas de calidad para un canal */
  public getChannelQualityStats(channel: string): { 
    avgQuality: number, 
    avgConfidence: number, 
    trend: 'improving' | 'stable' | 'degrading'
  } | null {
    if (!this.channelHistory.has(channel) || this.channelHistory.get(channel)!.length === 0) {
      return null;
    }
    
    const history = this.channelHistory.get(channel)!;
    
    // Calcular promedios
    const avgQuality = history.reduce((sum, item) => sum + item.quality, 0) / history.length;
    const avgConfidence = history.reduce((sum, item) => sum + item.confidence, 0) / history.length;
    
    // Determinar tendencia
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (history.length >= 3) {
      const recent = history.slice(-3);
      const older = history.slice(0, -3);
      
      if (older.length > 0) {
        const recentAvg = recent.reduce((sum, item) => sum + item.quality, 0) / recent.length;
        const olderAvg = older.reduce((sum, item) => sum + item.quality, 0) / older.length;
        
        if (recentAvg > olderAvg * 1.1) {
          trend = 'improving';
        } else if (recentAvg < olderAvg * 0.9) {
          trend = 'degrading';
        }
      }
    }
    
    return { avgQuality, avgConfidence, trend };
  }

  /** Permite resetear todos los canales */
  public resetAll(): void {
    for (const optimizer of this.channelOptimizers.values()) {
      optimizer.reset();
    }
    this.channelHistory.clear();
  }

  /** Permite resetear un canal específico */
  public resetChannel(channel: string): void {
    if (!this.channelOptimizers.has(channel)) return;
    this.channelOptimizers.get(channel)!.reset();
    this.channelHistory.set(channel, []);
  }
}

export type { SignalChannelOptimizerParams };

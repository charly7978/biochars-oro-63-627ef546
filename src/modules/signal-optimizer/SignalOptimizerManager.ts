import { SignalChannelOptimizer, ChannelFeedback, SignalChannelOptimizerParams } from './SignalChannelOptimizer';

/**
 * Manager de optimización de señales multicanal con feedback bidireccional
 * Permite integración con UI para intervención manual y feedback automático de los algoritmos de resultados
 * Ahora incluye aprendizaje automático ligero y feedback cruzado entre canales
 */
export class SignalOptimizerManager {
  private channelOptimizers: Map<string, SignalChannelOptimizer> = new Map();
  // Almacena los últimos feedbacks para feedback cruzado
  private lastFeedbacks: Record<string, ChannelFeedback> = {};
  // Almacena los últimos parámetros manuales aplicados por el usuario
  private manualParams: Record<string, Partial<SignalChannelOptimizerParams>> = {};

  /** Inicializa canales con parámetros opcionales */
  constructor(channelConfigs: Record<string, Partial<SignalChannelOptimizerParams>> = {}) {
    for (const channel of Object.keys(channelConfigs)) {
      this.channelOptimizers.set(channel, new SignalChannelOptimizer(channelConfigs[channel]));
    }
  }

  /** Procesa un valor por canal y devuelve la señal optimizada */
  public process(channel: string, value: number, confidence: number = 1, quality: number = 100): number {
    if (!this.channelOptimizers.has(channel)) {
      this.channelOptimizers.set(channel, new SignalChannelOptimizer());
    }
    // Usar parámetros manuales si existen
    if (this.manualParams[channel]) {
      this.channelOptimizers.get(channel)!.setParams(this.manualParams[channel]);
    }
    // Procesar y almacenar histórico
    return this.channelOptimizers.get(channel)!.process(value, confidence, quality);
  }

  /** Aplica feedback a un canal específico y realiza feedback cruzado */
  public applyFeedback(channel: string, feedback: ChannelFeedback): void {
    if (!this.channelOptimizers.has(channel)) return;
    // Guardar feedback para feedback cruzado
    this.lastFeedbacks[channel] = feedback;
    // Ajuste automático de parámetros según confianza
    const optimizer = this.channelOptimizers.get(channel)!;
    const currentParams = optimizer.getParams();
    if (feedback.confidence < 0.6) {
      optimizer.setParams({ gain: Math.min(4.0, (currentParams.gain || 1.0) + 0.15) });
      if (currentParams.filterType !== 'kalman') {
        optimizer.setParams({ filterType: 'kalman' });
      }
    } else if (feedback.confidence > 0.9) {
      optimizer.setParams({ gain: Math.max(1.0, (currentParams.gain || 1.0) - 0.1) });
      if (currentParams.filterType !== 'sma') {
        optimizer.setParams({ filterType: 'sma' });
      }
    }
    optimizer.applyFeedback(feedback);
    // Feedback cruzado: si un canal tiene mala calidad/confianza, sugerir ajuste en otros canales
    if (feedback.confidence < 0.6 || feedback.quality < 60) {
      for (const [otherChannel, otherOptimizer] of this.channelOptimizers.entries()) {
        if (otherChannel !== channel) {
          // Sugerir ajuste en el otro canal si también tiene baja calidad/confianza
          const otherFeedback = this.lastFeedbacks[otherChannel];
          if (!otherFeedback || otherFeedback.confidence > 0.7) {
            // Sugerir parámetros más robustos en el otro canal
            const suggested = otherOptimizer.suggestParams();
            otherOptimizer.setParams(suggested);
          }
        }
      }
    }
    // Aprendizaje automático ligero: refinar parámetros automáticamente en segundo plano
    setTimeout(() => {
      const suggested = optimizer.suggestParams();
      optimizer.setParams(suggested);
    }, 0);
  }

  /** Permite exponer los parámetros actuales de un canal para UI/manual */
  public getParams(channel: string): SignalChannelOptimizerParams | null {
    if (!this.channelOptimizers.has(channel)) return null;
    return this.channelOptimizers.get(channel)!.getParams();
  }

  /** Permite setear parámetros manualmente (UI) para un canal */
  public setParams(channel: string, newParams: Partial<SignalChannelOptimizerParams>): void {
    if (!this.channelOptimizers.has(channel)) return;
    this.manualParams[channel] = { ...newParams };
    this.channelOptimizers.get(channel)!.setParams(newParams);
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

  /** Permite resetear todos los canales */
  public resetAll(): void {
    for (const optimizer of this.channelOptimizers.values()) {
      optimizer.reset();
    }
    this.manualParams = {};
    this.lastFeedbacks = {};
  }

  /** Permite resetear un canal específico */
  public resetChannel(channel: string): void {
    if (!this.channelOptimizers.has(channel)) return;
    this.channelOptimizers.get(channel)!.reset();
    delete this.manualParams[channel];
    delete this.lastFeedbacks[channel];
  }
}

export type { SignalChannelOptimizerParams };

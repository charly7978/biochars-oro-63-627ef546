import { SignalChannelOptimizer, ChannelFeedback, SignalChannelOptimizerParams } from './SignalChannelOptimizer';

/**
 * Manager de optimización de señales multicanal con feedback bidireccional
 * Permite integración con UI para intervención manual y feedback automático de los algoritmos de resultados
 */
export class SignalOptimizerManager {
  private channelOptimizers: Map<string, SignalChannelOptimizer> = new Map();

  /** Inicializa canales con parámetros opcionales */
  constructor(channelConfigs: Record<string, Partial<SignalChannelOptimizerParams>> = {}) {
    for (const channel of Object.keys(channelConfigs)) {
      this.channelOptimizers.set(channel, new SignalChannelOptimizer(channelConfigs[channel]));
    }
  }

  /** Procesa un valor por canal y devuelve la señal optimizada */
  public process(channel: string, value: number): number {
    if (!this.channelOptimizers.has(channel)) {
      this.channelOptimizers.set(channel, new SignalChannelOptimizer());
    }
    return this.channelOptimizers.get(channel)!.process(value);
  }

  /** Aplica feedback a un canal específico */
  public applyFeedback(channel: string, feedback: ChannelFeedback): void {
    if (!this.channelOptimizers.has(channel)) return;
    // Ajuste automático de parámetros según confianza
    const optimizer = this.channelOptimizers.get(channel)!;
    const currentParams = optimizer.getParams();
    if (feedback.confidence < 0.6) {
      // Ganancia máxima 4.0
      optimizer.setParams({ gain: Math.min(4.0, (currentParams.gain || 1.0) + 0.15) });
      // Cambiar a filtro más robusto si no está en 'kalman'
      if (currentParams.filterType !== 'kalman') {
        optimizer.setParams({ filterType: 'kalman' });
      }
    } else if (feedback.confidence > 0.9) {
      // Ganancia mínima 1.0
      optimizer.setParams({ gain: Math.max(1.0, (currentParams.gain || 1.0) - 0.1) });
      // Si la confianza es muy alta, se puede usar un filtro más rápido
      if (currentParams.filterType !== 'sma') {
        optimizer.setParams({ filterType: 'sma' });
      }
    }
    optimizer.applyFeedback(feedback);
  }

  /** Permite exponer los parámetros actuales de un canal para UI/manual */
  public getParams(channel: string): SignalChannelOptimizerParams | null {
    if (!this.channelOptimizers.has(channel)) return null;
    return this.channelOptimizers.get(channel)!.getParams();
  }

  /** Permite setear parámetros manualmente (UI) para un canal */
  public setParams(channel: string, newParams: Partial<SignalChannelOptimizerParams>): void {
    if (!this.channelOptimizers.has(channel)) return;
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
  }

  /** Permite resetear un canal específico */
  public resetChannel(channel: string): void {
    if (!this.channelOptimizers.has(channel)) return;
    this.channelOptimizers.get(channel)!.reset();
  }
}

export type { SignalChannelOptimizerParams };

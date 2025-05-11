/**
 * Optimizador de señal por canal con feedback bidireccional (automático y manual)
 * Permite ajuste fino de parámetros de filtrado, ganancia, etc. por canal fisiológico
 */

export interface ChannelFeedback {
  confidence: number; // Confianza del resultado (0-1)
  error?: number;     // Error estimado
  quality: number;    // Calidad de la señal (0-100)
  metricType: string; // Tipo de métrica (ej: HR, SpO2)
  suggestedGain?: number;
  suggestedFilterParams?: any;
  manualOverride?: boolean;
  manualParams?: Partial<SignalChannelOptimizerParams>;
}

export interface SignalChannelOptimizerParams {
  gain: number;
  filterType: 'sma' | 'ema' | 'kalman' | 'none';
  filterWindow: number;
  emaAlpha: number;
  kalmanQ: number;
  kalmanR: number;
}

export class SignalChannelOptimizer {
  private params: SignalChannelOptimizerParams;
  private buffer: number[] = [];
  private lastFiltered: number = 0;
  private lastRaw: number = 0;
  private kalmanState = { P: 1, X: 0, K: 0 };

  constructor(initialParams?: Partial<SignalChannelOptimizerParams>) {
    this.params = {
      gain: 1.0,
      filterType: 'sma',
      filterWindow: 5,
      emaAlpha: 0.3,
      kalmanQ: 0.1,
      kalmanR: 0.01,
      ...initialParams,
    };
  }

  /** Procesa un valor crudo y devuelve la señal optimizada */
  public process(value: number): number {
    this.lastRaw = value;
    let filtered = value;
    // Filtro seleccionado
    switch (this.params.filterType) {
      case 'sma':
        this.buffer.push(value);
        if (this.buffer.length > this.params.filterWindow) this.buffer.shift();
        filtered = this.buffer.reduce((a, b) => a + b, 0) / this.buffer.length;
        break;
      case 'ema':
        filtered = this.params.emaAlpha * value + (1 - this.params.emaAlpha) * (this.lastFiltered || value);
        break;
      case 'kalman':
        filtered = this.applyKalmanFilter(value);
        break;
      case 'none':
      default:
        filtered = value;
    }
    // Aplicar ganancia
    filtered = (filtered - this.getMean()) * this.params.gain + this.getMean();
    this.lastFiltered = filtered;
    return filtered;
  }

  /** Aplica feedback automático o manual para ajustar parámetros */
  public applyFeedback(feedback: ChannelFeedback): void {
    // Feedback automático
    if (!feedback.manualOverride) {
      // Ajuste de ganancia según confianza/calidad
      if (feedback.confidence < 0.6 && this.params.gain < 4.0) {
        this.params.gain += 0.1;
      } else if (feedback.confidence > 0.9 && this.params.gain > 1.0) {
        this.params.gain -= 0.05;
      }
      // Ajuste de filtro sugerido
      if (feedback.suggestedFilterParams) {
        Object.assign(this.params, feedback.suggestedFilterParams);
      }
    } else if (feedback.manualParams) {
      // Intervención manual: sobrescribe parámetros
      Object.assign(this.params, feedback.manualParams);
    }
  }

  /** Permite exponer los parámetros actuales para UI/manual */
  public getParams(): SignalChannelOptimizerParams {
    return { ...this.params };
  }

  /** Permite setear parámetros manualmente (UI) */
  public setParams(newParams: Partial<SignalChannelOptimizerParams>): void {
    Object.assign(this.params, newParams);
  }

  /** Devuelve el último valor filtrado */
  public getLastFiltered(): number {
    return this.lastFiltered;
  }

  /** Devuelve el último valor crudo */
  public getLastRaw(): number {
    return this.lastRaw;
  }

  /** Calcula la media del buffer */
  private getMean(): number {
    if (this.buffer.length === 0) return 0;
    return this.buffer.reduce((a, b) => a + b, 0) / this.buffer.length;
  }

  /** Filtro de Kalman simple */
  private applyKalmanFilter(measurement: number): number {
    const { Q, R } = { Q: this.params.kalmanQ, R: this.params.kalmanR };
    let { P, X, K } = this.kalmanState;
    P = P + Q;
    K = P / (P + R);
    X = X + K * (measurement - X);
    P = (1 - K) * P;
    this.kalmanState = { P, X, K };
    return X;
  }

  /** Resetea el buffer y estado */
  public reset(): void {
    this.buffer = [];
    this.lastFiltered = 0;
    this.lastRaw = 0;
    this.kalmanState = { P: 1, X: 0, K: 0 };
  }
} 
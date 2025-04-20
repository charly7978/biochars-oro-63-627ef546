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
  filterType: 'sma' | 'ema' | 'kalman' | 'bandpass' | 'wavelet' | 'none';
  filterWindow: number;
  emaAlpha: number;
  kalmanQ: number;
  kalmanR: number;
  // Nuevos parámetros para filtros avanzados
  bandpassLowCut?: number; // Frecuencia de corte inferior para bandpass
  bandpassHighCut?: number; // Frecuencia de corte superior para bandpass
  samplingRate?: number; // Tasa de muestreo estimada (para filtros que la requieren)
  adaptiveMode?: boolean; // Modo adaptativo para filtros
}

export class SignalChannelOptimizer {
  private params: SignalChannelOptimizerParams;
  private buffer: number[] = [];
  private bufferSum: number = 0; // Acumulador para SMA optimizado
  private lastFiltered: number = 0;
  private lastRaw: number = 0;
  private kalmanState = { P: 1, X: 0, K: 0 };
  
  // Buffer para implementaciones de filtros avanzados
  private advancedBuffer: number[] = [];
  private lastFilteredValues: number[] = []; // Para análisis de calidad
  private sampleTimes: number[] = []; // Tiempos de muestra para estimar tasa de muestreo
  private estimatedSamplingRate: number = 30; // Valor por defecto: 30 Hz

  constructor(initialParams?: Partial<SignalChannelOptimizerParams>) {
    this.params = {
      gain: 1.8,
      filterType: 'sma',
      filterWindow: 2,
      emaAlpha: 0.7,
      kalmanQ: 0.3,
      kalmanR: 0.05,
      bandpassLowCut: 0.5, // 0.5 Hz (~30 BPM)
      bandpassHighCut: 4.0, // 4.0 Hz (~240 BPM)
      samplingRate: 30,     // 30 Hz por defecto
      adaptiveMode: true,   // Modo adaptativo activado por defecto
      ...initialParams,
    };
  }

  /**
   * Procesa un valor crudo y devuelve la señal optimizada.
   * Optimiza el cálculo del filtro SMA usando un acumulador.
   */
  public process(value: number): number {
    // Registrar timestamp para cálculo de tasa de muestreo
    const now = Date.now();
    this.sampleTimes.push(now);
    if (this.sampleTimes.length > 60) { // Mantener solo hasta 60 muestras
      this.sampleTimes.shift();
    }
    
    // Actualizar tasa de muestreo estimada si tenemos suficientes muestras
    if (this.sampleTimes.length > 10) {
      const timeSpan = this.sampleTimes[this.sampleTimes.length - 1] - this.sampleTimes[0];
      this.estimatedSamplingRate = (this.sampleTimes.length - 1) / (timeSpan / 1000);
      // Actualizar parámetro en configuración
      this.params.samplingRate = this.estimatedSamplingRate;
    }
    
    this.lastRaw = value;
    
    // Añadir valor al buffer avanzado
    this.advancedBuffer.push(value);
    if (this.advancedBuffer.length > 128) { // Limitar tamaño para filtros avanzados
      this.advancedBuffer.shift();
    }
    
    let filtered = value;
    
    // Aplicar filtro según configuración
    switch (this.params.filterType) {
      case 'sma':
        filtered = this.applySMAFilter(value);
        break;
      case 'ema':
        filtered = this.applyEMAFilter(value);
        break;
      case 'kalman':
        filtered = this.applyKalmanFilter(value);
        break;
      case 'bandpass':
        filtered = this.applyBandpassFilter(value);
        break;
      case 'wavelet':
        filtered = this.applyWaveletFilter(value);
        break;
      case 'none':
      default:
        filtered = value;
    }
    
    // Aplicar ganancia validada
    const gain = this.clamp(this.params.gain, 0.5, 5.0);
    
    // Estilo de aplicación de ganancia que preserva la media
    const mean = this.getMean();
    filtered = (filtered - mean) * gain + mean;
    
    // Guardar valor filtrado en historial para análisis
    this.lastFilteredValues.push(filtered);
    if (this.lastFilteredValues.length > 30) {
      this.lastFilteredValues.shift();
    }
    
    this.lastFiltered = filtered;
    return filtered;
  }

  /**
   * Filtro SMA (Simple Moving Average)
   */
  private applySMAFilter(value: number): number {
    this.buffer.push(value);
    this.bufferSum += value;
    if (this.buffer.length > this.params.filterWindow) {
      this.bufferSum -= this.buffer.shift()!;
    }
    return this.bufferSum / this.buffer.length;
  }
  
  /**
   * Filtro EMA (Exponential Moving Average)
   */
  private applyEMAFilter(value: number): number {
    const alpha = this.params.emaAlpha;
    return alpha * value + (1 - alpha) * (this.lastFiltered || value);
  }
  
  /**
   * Filtro de Kalman simple
   */
  private applyKalmanFilter(measurement: number): number {
    const { kalmanQ: Q, kalmanR: R } = this.params;
    let { P, X, K } = this.kalmanState;
    
    // Predicción
    P = P + Q;
    
    // Actualización
    K = P / (P + R);
    X = X + K * (measurement - X);
    P = (1 - K) * P;
    
    this.kalmanState = { P, X, K };
    return X;
  }
  
  /**
   * Filtro paso banda digital simplificado - optimizado para señales PPG
   * Implementación de un filtro IIR simplificado
   */
  private applyBandpassFilter(value: number): number {
    const minSamples = 4;
    
    // Añadir valor al buffer
    this.advancedBuffer.push(value);
    
    // Si no hay suficientes muestras, devolver valor sin filtrar
    if (this.advancedBuffer.length < minSamples) {
      return value;
    }
    
    // Mantener tamaño del buffer
    const maxBufferSize = 16; // Suficiente para análisis PPG básico
    if (this.advancedBuffer.length > maxBufferSize) {
      this.advancedBuffer.shift();
    }
    
    // Obtener recorte del buffer para procesamiento
    const buffer = this.advancedBuffer.slice(-minSamples);
    
    // Parámetros del filtro
    const lowCut = this.params.bandpassLowCut || 0.5; // ~30 BPM por defecto
    const highCut = this.params.bandpassHighCut || 4.0; // ~240 BPM por defecto
    const fs = this.params.samplingRate || 30; // Frecuencia de muestreo
    
    // Coeficientes simplificados para un filtro IIR de 2do orden
    const omega1 = 2 * Math.PI * lowCut / fs;
    const omega2 = 2 * Math.PI * highCut / fs;
    
    // Implementación simplificada de filtro paso banda (versión optimizada móvil)
    // Usar una combinación de filtros RC digitales para aproximar paso banda
    
    // Paso alto (para eliminar componente DC y frecuencias bajas)
    const alphaHigh = 1 / (1 + omega1);
    // Inicializar highPassOut con un valor razonable
    let highPassOut = buffer[3] - buffer[2]; // Diferencia actual
    highPassOut = alphaHigh * highPassOut;
    
    // Paso bajo (para eliminar ruido de alta frecuencia)
    const alphaLow = omega2 / (omega2 + 1);
    let lowPassOut = this.lastFiltered || value; // Usar último valor filtrado
    lowPassOut = lowPassOut + alphaLow * (highPassOut - lowPassOut);
    
    return lowPassOut;
  }
  
  /**
   * Implementación simplificada de filtro wavelet para dispositivos móviles
   * Basado en transformada de Haar (la más simple de las wavelets)
   */
  private applyWaveletFilter(value: number): number {
    // Añadir valor al buffer si es necesario (ya lo hacemos en process)
    // Necesitamos potencia de 2 para Haar wavelet
    const minSamples = 16; // Pequeño para cálculo en tiempo real
    
    // Si no hay suficientes muestras, aplicar filtro simple
    if (this.advancedBuffer.length < minSamples) {
      return this.applyEMAFilter(value);
    }
    
    // Obtener una ventana de potencia de 2 para wavelet
    const buffer = this.advancedBuffer.slice(-minSamples);
    
    // Implementar transformada wavelet de Haar nivel 1 (simple)
    const approximation: number[] = [];
    for (let i = 0; i < buffer.length; i += 2) {
      approximation.push((buffer[i] + buffer[i+1]) / 2);
    }
    
    // Reconstruir señal filtrada (solo nivel 1 para rendimiento)
    const reconstructed: number[] = [];
    for (let i = 0; i < approximation.length; i++) {
      reconstructed.push(approximation[i]);
      reconstructed.push(approximation[i]);
    }
    
    // Devolver último valor reconstruido
    return reconstructed[reconstructed.length - 1];
  }
  
  /**
   * Evalúa la calidad del filtrado actual y puede sugerir mejoras
   */
  public evaluateFilterQuality(): { 
    quality: number, 
    suggestedFilterType?: SignalChannelOptimizerParams['filterType'],
    message: string
  } {
    if (this.lastFilteredValues.length < 10) {
      return { quality: 0.5, message: 'Insuficientes datos para evaluación' };
    }
    
    // Analizar varianza de la señal filtrada
    const mean = this.lastFilteredValues.reduce((a, b) => a + b, 0) / this.lastFilteredValues.length;
    const variance = this.lastFilteredValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / this.lastFilteredValues.length;
    
    // Analizar suavidad (diferencias entre muestras consecutivas)
    let totalDiff = 0;
    for (let i = 1; i < this.lastFilteredValues.length; i++) {
      totalDiff += Math.abs(this.lastFilteredValues[i] - this.lastFilteredValues[i-1]);
    }
    const avgDiff = totalDiff / (this.lastFilteredValues.length - 1);
    
    // Calcular score de calidad combinado
    let qualityScore = 0;
    
    // Penalizar:
    // - Varianza excesiva (ruido) o muy baja (sobre-filtrado)
    // - Diferencias muy altas entre muestras (inestabilidad) o muy bajas (sobre-filtrado)
    
    // Escala de varianza óptima para PPG
    const optimalVariance = 4.0;
    const varianceScore = Math.exp(-Math.pow((variance - optimalVariance) / 4.0, 2));
    
    // Escala de diferencia óptima para PPG (depende de la amplitud)
    const normalizedAvgDiff = avgDiff / (Math.max(...this.lastFilteredValues) - Math.min(...this.lastFilteredValues) + 0.1);
    const optimalNormDiff = 0.02; // 2% de cambio entre muestras
    const diffScore = Math.exp(-Math.pow((normalizedAvgDiff - optimalNormDiff) / 0.02, 2));
    
    // Combinar scores
    qualityScore = 0.6 * varianceScore + 0.4 * diffScore;
    
    // Sugerir cambio de filtro si calidad es baja
    let suggestedFilter: SignalChannelOptimizerParams['filterType'] | undefined;
    let message = 'Filtrado óptimo';
    
    if (qualityScore < 0.5) {
      if (variance > optimalVariance * 2) {
        // Demasiado ruido, sugerir filtrado más agresivo
        suggestedFilter = 'kalman';
        message = 'Señal con ruido, cambiando a filtro Kalman';
      } else if (variance < optimalVariance / 2) {
        // Señal sobre-filtrada, sugerir filtrado más ligero
        suggestedFilter = 'ema';
        message = 'Señal sobre-filtrada, cambiando a EMA';
      } else {
        // Problemas de frecuencia, sugerir bandpass
        suggestedFilter = 'bandpass';
        message = 'Problemas de frecuencia, cambiando a filtro paso-banda';
      }
    }
    
    return {
      quality: qualityScore,
      suggestedFilterType: suggestedFilter,
      message
    };
  }

  /**
   * Aplica feedback automático o manual para ajustar parámetros.
   * Valida los parámetros antes de asignar.
   */
  public applyFeedback(feedback: ChannelFeedback): void {
    // Feedback automático
    if (!feedback.manualOverride) {
      // Ajuste de ganancia según confianza/calidad
      if (feedback.confidence < 0.6 && this.params.gain < 5.0) {
        this.params.gain = this.clamp(this.params.gain + 0.2, 0.5, 5.0);
      } else if (feedback.confidence > 0.9 && this.params.gain > 1.0) {
        this.params.gain = this.clamp(this.params.gain - 0.05, 0.5, 5.0);
      }
      
      // Evaluar calidad del filtro actual y cambiar si es necesario
      if (this.params.adaptiveMode) {
        const evaluation = this.evaluateFilterQuality();
        if (evaluation.suggestedFilterType && evaluation.quality < 0.5) {
          console.log(`[SignalOptimizer] ${evaluation.message} (calidad: ${evaluation.quality.toFixed(2)})`);
          this.params.filterType = evaluation.suggestedFilterType;
        }
      }
      
      // Ajuste de filtro sugerido
      if (feedback.suggestedFilterParams) {
        Object.assign(this.params, this.validateParams(feedback.suggestedFilterParams));
      }
    } else if (feedback.manualParams) {
      // Intervención manual: sobrescribe parámetros validados
      Object.assign(this.params, this.validateParams(feedback.manualParams));
    }
  }

  /**
   * Valida y limita los parámetros del optimizador a rangos razonables.
   */
  private validateParams(params: Partial<SignalChannelOptimizerParams>): Partial<SignalChannelOptimizerParams> {
    const validated: Partial<SignalChannelOptimizerParams> = { ...params };
    if (validated.gain !== undefined) validated.gain = this.clamp(validated.gain, 0.5, 5.0);
    if (validated.filterWindow !== undefined) validated.filterWindow = Math.max(1, Math.min(50, validated.filterWindow));
    if (validated.emaAlpha !== undefined) validated.emaAlpha = Math.max(0.01, Math.min(0.99, validated.emaAlpha));
    if (validated.kalmanQ !== undefined) validated.kalmanQ = Math.max(0.0001, Math.min(10, validated.kalmanQ));
    if (validated.kalmanR !== undefined) validated.kalmanR = Math.max(0.0001, Math.min(10, validated.kalmanR));
    if (validated.bandpassLowCut !== undefined) validated.bandpassLowCut = Math.max(0.1, Math.min(2.0, validated.bandpassLowCut));
    if (validated.bandpassHighCut !== undefined) validated.bandpassHighCut = Math.max(2.0, Math.min(10.0, validated.bandpassHighCut));
    if (validated.samplingRate !== undefined) validated.samplingRate = Math.max(10, Math.min(120, validated.samplingRate));
    return validated;
  }

  /**
   * Limita un valor entre un mínimo y un máximo.
   */
  private clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
  }

  /** Permite exponer los parámetros actuales para UI/manual */
  public getParams(): SignalChannelOptimizerParams {
    return { ...this.params };
  }

  /** Permite setear parámetros manualmente (UI) */
  public setParams(newParams: Partial<SignalChannelOptimizerParams>): void {
    Object.assign(this.params, this.validateParams(newParams));
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
    return this.bufferSum / this.buffer.length;
  }

  /** Resetea el buffer y estado */
  public reset(): void {
    this.buffer = [];
    this.bufferSum = 0;
    this.lastFiltered = 0;
    this.lastRaw = 0;
    this.kalmanState = { P: 1, X: 0, K: 0 };
    this.advancedBuffer = [];
    this.lastFilteredValues = [];
    this.sampleTimes = [];
  }
} 
/**
 * SignalAmplifier.ts
 * Optimizado para una mejor detección de señal PPG y reducción de ruido
 */

export class SignalAmplifier {
  // Parámetros de amplificación optimizados
  private readonly MIN_GAIN = 1.2;
  private readonly MAX_GAIN = 6.0; // Aumentado de 4.5 a 6.0 para mejor detección
  private readonly NOISE_THRESHOLD = 0.15;
  private readonly SIGNAL_BUFFER_SIZE = 20;
  private readonly LONG_BUFFER_SIZE = 60;
  private readonly ADAPTATION_RATE = 0.08;
  private readonly HARMONICS_WINDOW = 30; // Ventana para análisis de armónicos
  private readonly BASELINE_ALPHA = 0.02; // Tasa de adaptación de línea base
  private readonly VARIANCE_THRESHOLD = {
    LOW: 0.001,
    MEDIUM: 0.01,
    HIGH: 0.05
  };

  // Buffer y estado
  private signalBuffer: number[] = [];
  private longTermBuffer: number[] = [];
  private baselineValue = 0;
  private currentGain = 2.0;
  private lastQuality = 0;
  private dominantFrequency = 0;
  private harmonicStrength = 0;
  private signalVariance = 0;
  private readonly LAST_VALUES_SIZE = 5;
  private lastValues: number[] = [];
  private lastAmplifiedValues: number[] = [];
  private baselineHistory: number[] = [];

  constructor() {
    this.reset();
  }

  /**
   * Procesa y amplifica un valor PPG raw con corrección mejorada
   */
  public processValue(rawValue: number): { 
    amplifiedValue: number; 
    quality: number;
    dominantFrequency: number;
  } {
    // Corrección de línea base mejorada
    this.updateEnhancedBaseline(rawValue);
    const normalizedValue = rawValue - this.baselineValue;
    
    // Actualizar buffers
    this.signalBuffer.push(normalizedValue);
    this.longTermBuffer.push(normalizedValue);
    
    if (this.signalBuffer.length > this.SIGNAL_BUFFER_SIZE) {
      this.signalBuffer.shift();
    }
    
    if (this.longTermBuffer.length > this.LONG_BUFFER_SIZE) {
      this.longTermBuffer.shift();
    }
    
    // Mantener valores raw recientes para análisis
    this.lastValues.push(rawValue);
    if (this.lastValues.length > this.LAST_VALUES_SIZE) {
      this.lastValues.shift();
    }
    
    // Calcular varianza de señal para ajuste dinámico
    this.updateSignalVariance();
    
    // Analizar calidad de señal con métricas mejoradas
    const signalQuality = this.calculateEnhancedSignalQuality();
    
    // Ajustar ganancia dinámicamente basado en calidad y varianza
    this.adjustDynamicGain(signalQuality);
    
    // Detectar y enfatizar componentes periódicos
    if (this.longTermBuffer.length > 30) {
      this.updateHarmonicAnalysis();
    }
    
    // Aplicar amplificación adaptativa con énfasis en armónicos
    const amplifiedValue = this.applyEnhancedAmplification(normalizedValue);
    
    // Actualizar historial de valores amplificados
    this.lastAmplifiedValues.push(amplifiedValue);
    if (this.lastAmplifiedValues.length > this.LAST_VALUES_SIZE) {
      this.lastAmplifiedValues.shift();
    }
    
    return { 
      amplifiedValue,
      quality: signalQuality,
      dominantFrequency: this.dominantFrequency
    };
  }

  /**
   * Actualización mejorada de línea base con filtrado adaptativo
   */
  private updateEnhancedBaseline(value: number): void {
    if (this.baselineValue === 0) {
      this.baselineValue = value;
    } else {
      // Adaptar tasa de corrección según variabilidad
      const adaptiveRate = this.BASELINE_ALPHA * 
        (1 + Math.min(3, this.signalVariance * 10));
      
      // Actualizar con peso adaptativo
      this.baselineValue = this.baselineValue * (1 - adaptiveRate) + 
                          value * adaptiveRate;
    }
    
    // Mantener historial de línea base
    this.baselineHistory.push(this.baselineValue);
    if (this.baselineHistory.length > this.LONG_BUFFER_SIZE) {
      this.baselineHistory.shift();
    }
  }

  /**
   * Actualizar varianza de señal para ajuste dinámico
   */
  private updateSignalVariance(): void {
    if (this.signalBuffer.length < 3) return;
    
    let sum = 0;
    let sumSquares = 0;
    
    for (const value of this.signalBuffer) {
      sum += value;
      sumSquares += value * value;
    }
    
    const mean = sum / this.signalBuffer.length;
    this.signalVariance = (sumSquares / this.signalBuffer.length) - (mean * mean);
  }

  /**
   * Ajuste dinámico de ganancia basado en calidad y varianza
   */
  private adjustDynamicGain(quality: number): void {
    let targetGain = this.currentGain;
    
    // Ajustar según varianza de señal
    if (this.signalVariance < this.VARIANCE_THRESHOLD.LOW) {
      // Señal muy estable, aumentar ganancia
      targetGain = Math.min(this.MAX_GAIN, this.currentGain * 1.1);
    } else if (this.signalVariance > this.VARIANCE_THRESHOLD.HIGH) {
      // Señal muy variable, reducir ganancia
      targetGain = Math.max(this.MIN_GAIN, this.currentGain * 0.9);
    }
    
    // Ajustar según calidad
    if (quality < 0.3) {
      targetGain = Math.min(this.MAX_GAIN, targetGain * 1.05);
    } else if (quality > 0.8) {
      targetGain = Math.max(this.MIN_GAIN, targetGain * 0.95);
    }
    
    // Aplicar cambio suavizado
    this.currentGain = this.currentGain * (1 - this.ADAPTATION_RATE) + 
                      targetGain * this.ADAPTATION_RATE;
  }

  /**
   * Análisis mejorado de componentes armónicos
   */
  private updateHarmonicAnalysis(): void {
    if (this.longTermBuffer.length < this.HARMONICS_WINDOW) return;
    
    const buffer = this.longTermBuffer.slice(-this.HARMONICS_WINDOW);
    const mean = buffer.reduce((a, b) => a + b, 0) / buffer.length;
    const normalized = buffer.map(v => v - mean);
    
    // Análisis de autocorrelación para detectar periodicidad
    let maxCorrelation = 0;
    let bestPeriod = 0;
    
    for (let lag = 4; lag <= 20; lag++) {
      let correlation = 0;
      for (let i = 0; i < normalized.length - lag; i++) {
        correlation += normalized[i] * normalized[i + lag];
      }
      
      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestPeriod = lag;
      }
    }
    
    // Actualizar métricas de armónicos
    this.harmonicStrength = maxCorrelation / (this.HARMONICS_WINDOW - bestPeriod);
    this.dominantFrequency = 30 / bestPeriod; // Asumiendo ~30fps
  }

  /**
   * Amplificación mejorada con énfasis en componentes periódicos
   */
  private applyEnhancedAmplification(normalizedValue: number): number {
    // Amplificación básica
    let amplifiedValue = normalizedValue * this.currentGain;
    
    // Énfasis en componentes periódicos
    if (this.harmonicStrength > 0.3) {
      const harmonicEmphasis = Math.min(1.5, 1 + this.harmonicStrength);
      amplifiedValue *= harmonicEmphasis;
    }
    
    // Limitar amplificación con suavizado
    const softLimit = (x: number, limit: number): number => {
      if (Math.abs(x) < limit) return x;
      const sign = x >= 0 ? 1 : -1;
      return sign * (limit + Math.log(1 + Math.abs(x) - limit));
    };
    
    const limitThreshold = 6.0; // Aumentado para coincidir con MAX_GAIN
    return softLimit(amplifiedValue, limitThreshold);
  }

  /**
   * Reset amplifier state
   */
  public reset(): void {
    this.signalBuffer = [];
    this.longTermBuffer = [];
    this.baselineValue = 0;
    this.currentGain = 2.0;
    this.lastQuality = 0;
    this.dominantFrequency = 0;
    this.lastValues = [];
    this.lastAmplifiedValues = [];
  }

  /**
   * Get current gain
   */
  public getCurrentGain(): number {
    return this.currentGain;
  }
}

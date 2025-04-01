
/**
 * SignalAmplifier.ts
 * 
 * Este módulo optimiza la señal PPG extraída del dedo para mejorar la detección de latidos
 * utilizando técnicas de amplificación adaptativa, filtrado de ruido y detección de periodicidad.
 */

export class SignalAmplifier {
  // Parámetros de amplificación
  private readonly MIN_GAIN = 1.2;
  private readonly MAX_GAIN = 4.5;
  private readonly NOISE_THRESHOLD = 0.15;
  private readonly SIGNAL_BUFFER_SIZE = 20;
  private readonly LONG_BUFFER_SIZE = 60;
  private readonly ADAPTATION_RATE = 0.08;
  private readonly FREQUENCY_BANDS = [0.8, 1.0, 1.3, 1.6, 2.0, 2.3, 2.6];
  private readonly QUALITY_THRESHOLDS = {
    LOW: 0.3,
    MEDIUM: 0.6,
    HIGH: 0.8
  };

  // Buffers y estado
  private signalBuffer: number[] = [];
  private longTermBuffer: number[] = [];
  private baselineValue = 0;
  private currentGain = 2.0;
  private lastQuality = 0;
  private dominantFrequency = 0;
  private lastValues: number[] = [];
  private readonly LAST_VALUES_SIZE = 5;
  private lastAmplifiedValues: number[] = [];

  constructor() {
    this.reset();
  }

  /**
   * Procesa y amplifica un valor PPG crudo
   */
  public processValue(rawValue: number): { 
    amplifiedValue: number; 
    quality: number;
    dominantFrequency: number;
  } {
    // Normalizar el valor respecto a la línea base
    this.updateBaseline(rawValue);
    const normalizedValue = rawValue - this.baselineValue;
    
    // Almacenar en buffer para análisis
    this.signalBuffer.push(normalizedValue);
    this.longTermBuffer.push(normalizedValue);
    
    if (this.signalBuffer.length > this.SIGNAL_BUFFER_SIZE) {
      this.signalBuffer.shift();
    }
    
    if (this.longTermBuffer.length > this.LONG_BUFFER_SIZE) {
      this.longTermBuffer.shift();
    }
    
    // Mantener los últimos valores crudos para análisis
    this.lastValues.push(rawValue);
    if (this.lastValues.length > this.LAST_VALUES_SIZE) {
      this.lastValues.shift();
    }
    
    // Analizar calidad de señal
    const signalQuality = this.calculateSignalQuality();
    
    // Ajustar ganancia dinámicamente según calidad
    this.adjustGain(signalQuality);
    
    // Detectar periodicidad y calcular frecuencia dominante 
    if (this.longTermBuffer.length > 30) {
      this.dominantFrequency = this.detectDominantFrequency();
    }
    
    // Aplicar amplificación adaptativa, enfatizando componentes periódicas
    const amplifiedValue = this.applyAdaptiveAmplification(normalizedValue);
    
    // Actualizar histórico de valores amplificados
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
   * Actualiza la línea base con adaptación lenta
   */
  private updateBaseline(value: number): void {
    if (this.baselineValue === 0) {
      this.baselineValue = value;
    } else {
      const adaptationRate = 0.005; // Muy lento para estabilidad
      this.baselineValue = this.baselineValue * (1 - adaptationRate) + value * adaptationRate;
    }
  }

  /**
   * Calcula la calidad de la señal basada en múltiples factores
   */
  private calculateSignalQuality(): number {
    if (this.signalBuffer.length < 10) {
      return this.lastQuality; // Mantener la última calidad hasta tener suficientes datos
    }
    
    // Calcular rango de amplitud (min a max)
    const max = Math.max(...this.signalBuffer);
    const min = Math.min(...this.signalBuffer);
    const range = max - min;
    
    // Calcular variabilidad a corto plazo (diferencias entre muestras consecutivas)
    let variabilitySum = 0;
    for (let i = 1; i < this.signalBuffer.length; i++) {
      variabilitySum += Math.abs(this.signalBuffer[i] - this.signalBuffer[i-1]);
    }
    const avgVariability = variabilitySum / (this.signalBuffer.length - 1);
    
    // Calcular periodicidad (autocorrelación simple)
    const periodicityScore = this.calculatePeriodicityScore();
    
    // Calcular ruido (componentes de alta frecuencia)
    const noiseScore = this.calculateNoiseScore();
    
    // Calcular estabilidad de línea base
    const baselineStability = this.calculateBaselineStability();
    
    // Ponderar factores para calidad final
    // Mayor peso a periodicidad y menor a ruido
    const rawQuality = (
      (range * 0.3) +                 // 30% amplitud 
      (periodicityScore * 0.4) +      // 40% periodicidad
      ((1 - noiseScore) * 0.2) +      // 20% ausencia de ruido
      (baselineStability * 0.1)       // 10% estabilidad
    );
    
    // Normalizar a 0-1
    const normalizedQuality = Math.min(1, Math.max(0, rawQuality));
    
    // Aplicar suavizado para evitar cambios bruscos
    this.lastQuality = this.lastQuality * 0.7 + normalizedQuality * 0.3;
    
    return this.lastQuality;
  }

  /**
   * Calcula puntuación de periodicidad basada en autocorrelación
   */
  private calculatePeriodicityScore(): number {
    if (this.signalBuffer.length < 10) return 0;
    
    const buffer = [...this.signalBuffer];
    const mean = buffer.reduce((a, b) => a + b, 0) / buffer.length;
    
    // Normalizar el buffer
    const normalizedBuffer = buffer.map(v => v - mean);
    
    let maxCorrelation = 0;
    
    // Buscar correlaciones en rangos de latidos normales (40-180 BPM)
    // Esto equivale aproximadamente a periodos de 15-30 muestras a 30fps
    const minLag = 4;
    const maxLag = 20;
    
    for (let lag = minLag; lag <= maxLag; lag++) {
      let correlation = 0;
      let norm1 = 0;
      let norm2 = 0;
      
      for (let i = 0; i < normalizedBuffer.length - lag; i++) {
        correlation += normalizedBuffer[i] * normalizedBuffer[i + lag];
        norm1 += normalizedBuffer[i] * normalizedBuffer[i];
        norm2 += normalizedBuffer[i + lag] * normalizedBuffer[i + lag];
      }
      
      // Normalizar la correlación a [-1, 1]
      const normalizedCorrelation = norm1 > 0 && norm2 > 0 ? 
        correlation / Math.sqrt(norm1 * norm2) : 0;
      
      // Tomamos el valor absoluto ya que nos interesa la correlación
      // independientemente del signo
      const absCorrelation = Math.abs(normalizedCorrelation);
      
      if (absCorrelation > maxCorrelation) {
        maxCorrelation = absCorrelation;
      }
    }
    
    // Transformar a una puntuación no lineal que premie correlaciones altas
    return Math.pow(maxCorrelation, 1.5);
  }

  /**
   * Estima nivel de ruido en la señal
   */
  private calculateNoiseScore(): number {
    if (this.signalBuffer.length < 10) return 1.0;
    
    // Calcular primera derivada (cambios entre muestras)
    const derivatives: number[] = [];
    for (let i = 1; i < this.signalBuffer.length; i++) {
      derivatives.push(this.signalBuffer[i] - this.signalBuffer[i-1]);
    }
    
    // Calcular segunda derivada (cambios en los cambios)
    const secondDerivatives: number[] = [];
    for (let i = 1; i < derivatives.length; i++) {
      secondDerivatives.push(derivatives[i] - derivatives[i-1]);
    }
    
    // El ruido se manifiesta como cambios rápidos en la segunda derivada
    // Calculamos la media absoluta de la segunda derivada
    const meanAbsSecondDerivative = secondDerivatives.reduce(
      (sum, val) => sum + Math.abs(val), 0
    ) / secondDerivatives.length;
    
    // Normalizar a [0,1] usando un umbral adaptativo
    const normalizedNoise = Math.min(
      1.0, 
      meanAbsSecondDerivative / (this.NOISE_THRESHOLD * Math.max(0.2, this.currentGain))
    );
    
    return normalizedNoise;
  }

  /**
   * Calcula estabilidad de la línea base
   */
  private calculateBaselineStability(): number {
    if (this.lastValues.length < this.LAST_VALUES_SIZE) return 0.5;
    
    // Calcular desviación estándar de los valores originales
    const mean = this.lastValues.reduce((a, b) => a + b, 0) / this.lastValues.length;
    const variance = this.lastValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / this.lastValues.length;
    const stdDev = Math.sqrt(variance);
    
    // Normalizar: menor desviación = mayor estabilidad
    // Usamos un umbral adaptativo basado en la ganancia actual
    const normalizedStability = Math.max(0, 1 - (stdDev / (10 * this.currentGain)));
    
    return normalizedStability;
  }

  /**
   * Ajusta la ganancia dinámicamente basada en calidad de señal
   */
  private adjustGain(quality: number): void {
    // Si la calidad es muy baja, aumentar ganancia
    // Si la calidad es buena, podemos reducir la ganancia
    let targetGain = this.currentGain;
    
    if (quality < this.QUALITY_THRESHOLDS.LOW) {
      // Calidad baja, aumentar ganancia gradualmente
      targetGain = Math.min(this.MAX_GAIN, this.currentGain * 1.05);
    } else if (quality < this.QUALITY_THRESHOLDS.MEDIUM) {
      // Calidad media, aumentar ligeramente
      targetGain = Math.min(this.MAX_GAIN, this.currentGain * 1.01);
    } else if (quality > this.QUALITY_THRESHOLDS.HIGH) {
      // Calidad alta, reducir para evitar saturación
      targetGain = Math.max(this.MIN_GAIN, this.currentGain * 0.99);
    }
    
    // Aplicar cambio suavizado
    this.currentGain = this.currentGain * (1 - this.ADAPTATION_RATE) + 
                      targetGain * this.ADAPTATION_RATE;
  }

  /**
   * Detecta la frecuencia dominante (ritmo cardíaco) en la señal
   */
  private detectDominantFrequency(): number {
    if (this.longTermBuffer.length < 30) return 0;
    
    const buffer = this.longTermBuffer.slice(-30);
    const mean = buffer.reduce((a, b) => a + b, 0) / buffer.length;
    const normalized = buffer.map(v => v - mean);
    
    // Simulación simplificada de análisis de frecuencia
    // Examinar correlación en distintas bandas de frecuencia típicas de ritmo cardíaco
    const freqScores: {freq: number, score: number}[] = [];
    
    for (const freq of this.FREQUENCY_BANDS) {
      // Convertir frecuencia (Hz) a periodo en muestras (asumiendo ~30fps)
      const period = Math.round(30 / freq);
      if (period < 4 || period > buffer.length / 2) continue;
      
      let score = 0;
      
      // Examinar correlación a la frecuencia actual
      for (let lag = period - 1; lag <= period + 1; lag++) {
        if (lag >= buffer.length - 5) continue;
        
        let correlation = 0;
        for (let i = 0; i < buffer.length - lag; i++) {
          correlation += normalized[i] * normalized[i + lag];
        }
        
        score = Math.max(score, Math.abs(correlation));
      }
      
      freqScores.push({freq, score});
    }
    
    // Encontrar la frecuencia con mayor puntuación
    let maxScore = 0;
    let dominantFreq = 0;
    
    for (const {freq, score} of freqScores) {
      if (score > maxScore) {
        maxScore = score;
        dominantFreq = freq;
      }
    }
    
    return dominantFreq;
  }

  /**
   * Aplica amplificación adaptativa considerando componentes periódicas
   */
  private applyAdaptiveAmplification(normalizedValue: number): number {
    // Amplificación básica
    let amplifiedValue = normalizedValue * this.currentGain;
    
    // Si tenemos una frecuencia dominante, aplicar realce selectivo
    if (this.dominantFrequency > 0 && this.lastQuality > this.QUALITY_THRESHOLDS.LOW) {
      // Calculamos periodo aproximado en muestras
      const dominantPeriod = Math.round(30 / this.dominantFrequency);
      
      // Si tenemos suficientes valores en el buffer
      if (this.signalBuffer.length >= dominantPeriod) {
        // Predecir componente periódica basada en muestras anteriores
        let periodicComponent = 0;
        let count = 0;
        
        // Promediamos valores a distancias de múltiplos del periodo
        for (let k = 1; k <= 3; k++) {
          const idx = this.signalBuffer.length - k * dominantPeriod;
          if (idx >= 0) {
            periodicComponent += this.signalBuffer[idx];
            count++;
          }
        }
        
        if (count > 0) {
          periodicComponent /= count;
          
          // Realzar componentes periódicas
          const emphasisFactor = 0.3 * Math.min(1.0, this.lastQuality * 1.5);
          amplifiedValue = amplifiedValue * (1 - emphasisFactor) + 
                          periodicComponent * this.currentGain * emphasisFactor;
        }
      }
    }
    
    // Aplicar limitación suave para evitar valores extremos
    const softLimit = (x: number, limit: number): number => {
      if (Math.abs(x) < limit) return x;
      const sign = x >= 0 ? 1 : -1;
      return sign * (limit + Math.log(1 + Math.abs(x) - limit));
    };
    
    const limitThreshold = 5.0;
    amplifiedValue = softLimit(amplifiedValue, limitThreshold);
    
    return amplifiedValue;
  }

  /**
   * Reiniciar estado del amplificador
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
   * Obtener ganancia actual
   */
  public getCurrentGain(): number {
    return this.currentGain;
  }
}

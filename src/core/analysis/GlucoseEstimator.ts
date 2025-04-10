
import { ProcessorConfig, DEFAULT_PROCESSOR_CONFIG } from '../config/ProcessorConfig';

export class GlucoseEstimator {
  // Parámetros fisiológicos y de calibración
  private readonly MIN_GLUCOSE = 70; // mg/dL - Límite inferior fisiológico
  private readonly MAX_GLUCOSE = 170; // mg/dL - Límite superior conservador
  private readonly DEFAULT_GLUCOSE = 95; // mg/dL - Valor basal normal en ayuno
  
  // Factores de ajuste basados en características de la señal
  private readonly AMPLITUDE_FACTOR = 0.12;
  private readonly RISE_TIME_FACTOR = 0.08;
  private readonly DECAY_FACTOR = 0.15;
  private readonly PEAK_WIDTH_FACTOR = 0.10;
  
  // Estabilidad de mediciones
  private readonly HISTORY_SIZE = 5;
  private readonly HISTORY_WEIGHT = 0.7;
  private readonly CURRENT_WEIGHT = 0.3;
  
  // Estado del estimador
  private calibrationFactor: number = 1.0;
  private measurementHistory: number[] = [];
  private lastConfidence: number = 0;
  private confidenceThreshold: number;
  
  constructor(config: Partial<ProcessorConfig> = {}) {
    const fullConfig = { ...DEFAULT_PROCESSOR_CONFIG, ...config };
    this.calibrationFactor = fullConfig.nonInvasiveSettings.glucoseCalibrationFactor;
    this.confidenceThreshold = fullConfig.nonInvasiveSettings.confidenceThreshold;
    this.reset();
    
    // Inicialización con valores basales
    this.measurementHistory = Array(this.HISTORY_SIZE).fill(this.DEFAULT_GLUCOSE);
  }
  
  /**
   * Estima nivel de glucosa basado en características de la señal PPG
   * Implementación basada en correlaciones de forma de onda con niveles de glucosa
   * 
   * IMPORTANTE: Esta es una ESTIMACIÓN basada en tendencias, NO una medición diagnóstica.
   * La correlación se basa en cambios en la refracción de la luz por concentración de glucosa.
   */
  public estimate(values: number[]): number {
    if (values.length < 100) {
      return this.getLastEstimate();
    }
    
    try {
      // Extraer segmento reciente de la señal
      const recentValues = values.slice(-150);
      
      // Extraer características clave de la forma de onda
      const features = this.extractWaveformFeatures(recentValues);
      
      // Calcular estimación base
      let baseEstimate = this.DEFAULT_GLUCOSE;
      
      // Ajustar estimación basada en características extraídas
      baseEstimate += features.riseFallRatio * 30 * this.RISE_TIME_FACTOR;
      baseEstimate += features.peakWidth * -15 * this.PEAK_WIDTH_FACTOR;
      baseEstimate += features.variabilityIndex * 25 * this.AMPLITUDE_FACTOR;
      baseEstimate += features.derivativeRatio * 20 * this.DECAY_FACTOR;
      
      // Aplicar factor de calibración
      baseEstimate *= this.calibrationFactor;
      
      // Limitar a rangos fisiológicos
      const boundedEstimate = Math.max(
        this.MIN_GLUCOSE, 
        Math.min(this.MAX_GLUCOSE, baseEstimate)
      );
      
      // Calcular confianza basada en calidad de características
      this.lastConfidence = this.calculateConfidence(features, recentValues);
      
      // Aplicar suavizado temporal con historial
      this.addToHistory(boundedEstimate);
      const smoothedEstimate = this.getSmoothedEstimate();
      
      return Math.round(smoothedEstimate);
    } catch (error) {
      console.error("Error estimando glucosa:", error);
      return this.getLastEstimate();
    }
  }
  
  /**
   * Extrae características relevantes de la forma de onda PPG
   * que correlacionan con niveles de glucosa en sangre
   */
  private extractWaveformFeatures(values: number[]): {
    derivativeRatio: number;
    riseFallRatio: number;
    variabilityIndex: number;
    peakWidth: number;
    pulsatilityIndex: number;
  } {
    // Encontrar picos en la señal
    const peaks = this.findPeaks(values);
    
    if (peaks.length < 3) {
      return {
        derivativeRatio: 0.5,
        riseFallRatio: 0.5,
        variabilityIndex: 0.5,
        peakWidth: 0.5,
        pulsatilityIndex: 0.5
      };
    }
    
    // Calcular primera derivada
    const derivative = values.slice(1).map((val, i) => val - values[i]);
    
    // Calcular segunda derivada
    const secondDerivative = derivative.slice(1).map((val, i) => val - derivative[i]);
    
    // Características biofísicas relacionadas con glucosa
    
    // 1. Ratio de derivadas positivas/negativas (absorción de infrarrojo)
    const positiveDerivSum = derivative.filter(d => d > 0).reduce((sum, val) => sum + val, 0);
    const negativeDerivSum = Math.abs(derivative.filter(d => d < 0).reduce((sum, val) => sum + val, 0));
    const derivativeRatio = positiveDerivSum / (negativeDerivSum || 1);
    
    // 2. Ratio tiempo de subida/bajada
    let riseTimeSum = 0;
    let fallTimeSum = 0;
    
    for (let i = 1; i < peaks.length; i++) {
      const peakIndex = peaks[i];
      const prevPeakIndex = peaks[i-1];
      
      // Encontrar valle entre picos
      let valleyIndex = prevPeakIndex;
      for (let j = prevPeakIndex; j < peakIndex; j++) {
        if (values[j] < values[valleyIndex]) {
          valleyIndex = j;
        }
      }
      
      // Tiempo de subida: valle a pico
      const riseTime = peakIndex - valleyIndex;
      
      // Tiempo de bajada: pico a valle
      const fallTime = valleyIndex - prevPeakIndex;
      
      if (riseTime > 0) riseTimeSum += riseTime;
      if (fallTime > 0) fallTimeSum += fallTime;
    }
    
    const riseFallRatio = (riseTimeSum / (fallTimeSum || 1));
    
    // 3. Índice de variabilidad (correlaciona con niveles de glucosa)
    const peakValues = peaks.map(idx => values[idx]);
    const peakVariance = this.calculateVariance(peakValues);
    const overallVariance = this.calculateVariance(values);
    const variabilityIndex = peakVariance / (overallVariance || 1);
    
    // 4. Anchura de pico promedio (ms)
    let totalWidth = 0;
    for (let i = 0; i < peaks.length; i++) {
      const peak = peaks[i];
      
      // Encontrar puntos de media amplitud
      const peakHeight = values[peak];
      const halfHeight = (peakHeight + Math.min(...values)) / 2;
      
      let leftIndex = peak;
      while (leftIndex > 0 && values[leftIndex] > halfHeight) {
        leftIndex--;
      }
      
      let rightIndex = peak;
      while (rightIndex < values.length - 1 && values[rightIndex] > halfHeight) {
        rightIndex++;
      }
      
      totalWidth += (rightIndex - leftIndex);
    }
    
    const peakWidth = totalWidth / peaks.length / 30; // Normalizado a segundos (asumiendo 30 fps)
    
    // 5. Índice de pulsatilidad (relacionado con viscosidad)
    const max = Math.max(...values);
    const min = Math.min(...values);
    const pulsatilityIndex = (max - min) / ((max + min) / 2);
    
    return {
      derivativeRatio: this.normalize(derivativeRatio, 0.5, 2.5),
      riseFallRatio: this.normalize(riseFallRatio, 0.3, 3.0),
      variabilityIndex: this.normalize(variabilityIndex, 0.02, 0.2),
      peakWidth: this.normalize(peakWidth, 0.2, 0.8),
      pulsatilityIndex: this.normalize(pulsatilityIndex, 0.05, 0.3)
    };
  }
  
  /**
   * Normaliza un valor a rango 0-1
   */
  private normalize(value: number, min: number, max: number): number {
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }
  
  /**
   * Calcula la varianza de un conjunto de valores
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }
  
  /**
   * Encuentra picos en la señal
   */
  private findPeaks(signal: number[]): number[] {
    const peaks: number[] = [];
    
    // Umbral dinámico basado en la amplitud de la señal
    const min = Math.min(...signal);
    const max = Math.max(...signal);
    const threshold = min + (max - min) * 0.6;
    
    // Detectar picos
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] > signal[i-1] && 
          signal[i] > signal[i+1] && 
          signal[i] > threshold) {
        
        // Asegurar distancia mínima entre picos
        if (peaks.length === 0 || i - peaks[peaks.length - 1] > 15) {
          peaks.push(i);
        }
      }
    }
    
    return peaks;
  }
  
  /**
   * Calcula nivel de confianza para la estimación
   */
  private calculateConfidence(features: any, signal: number[]): number {
    // Base de confianza
    let confidence = 0.5;
    
    // Ajustar por estabilidad de características
    const featureValues = Object.values(features) as number[];
    const featureVariance = this.calculateVariance(featureValues);
    confidence += (1 - featureVariance) * 0.2;
    
    // Ajustar por periodicidad de la señal
    const periodicityScore = this.evaluatePeriodicityScore(signal);
    confidence += periodicityScore * 0.2;
    
    // Ajustar por estabilidad de historial
    if (this.measurementHistory.length > 1) {
      const historyVariance = this.calculateVariance(this.measurementHistory);
      confidence += (1 - Math.min(1, historyVariance / 100)) * 0.1;
    }
    
    // Limitar a rango 0-1
    return Math.max(0, Math.min(1, confidence));
  }
  
  /**
   * Evalúa periodicidad de la señal como indicador de calidad
   */
  private evaluatePeriodicityScore(signal: number[]): number {
    if (signal.length < 60) return 0.5;
    
    // Autocorrelación simple
    let maxCorrelation = 0;
    const halfLength = Math.floor(signal.length / 2);
    
    for (let lag = 20; lag < halfLength; lag++) {
      let correlation = 0;
      let count = 0;
      
      for (let i = 0; i < halfLength; i++) {
        if (i + lag < signal.length) {
          correlation += signal[i] * signal[i + lag];
          count++;
        }
      }
      
      correlation = correlation / count;
      maxCorrelation = Math.max(maxCorrelation, correlation);
    }
    
    // Normalizar a 0-1
    const normalizedCorrelation = maxCorrelation / (Math.max(...signal) ** 2);
    return Math.min(1, normalizedCorrelation * 2);
  }
  
  /**
   * Agrega una estimación al historial
   */
  private addToHistory(value: number): void {
    this.measurementHistory.push(value);
    if (this.measurementHistory.length > this.HISTORY_SIZE) {
      this.measurementHistory.shift();
    }
  }
  
  /**
   * Obtiene estimación suavizada con historial
   */
  private getSmoothedEstimate(): number {
    if (this.measurementHistory.length === 0) {
      return this.DEFAULT_GLUCOSE;
    }
    
    // Usar últimas mediciones con ponderación
    const lastValue = this.measurementHistory[this.measurementHistory.length - 1];
    const historyAvg = this.measurementHistory.slice(0, -1)
      .reduce((sum, val) => sum + val, 0) / (this.measurementHistory.length - 1 || 1);
    
    return historyAvg * this.HISTORY_WEIGHT + lastValue * this.CURRENT_WEIGHT;
  }
  
  /**
   * Obtiene última estimación del historial
   */
  private getLastEstimate(): number {
    if (this.measurementHistory.length === 0) {
      return this.DEFAULT_GLUCOSE;
    }
    return this.measurementHistory[this.measurementHistory.length - 1];
  }
  
  /**
   * Calibra el estimador con un valor de referencia
   */
  public calibrate(referenceValue: number): void {
    if (referenceValue < 50 || referenceValue > 300) {
      console.warn("Valor de calibración de glucosa fuera de rango:", referenceValue);
      return;
    }
    
    const currentEstimate = this.getLastEstimate();
    if (currentEstimate > 0) {
      this.calibrationFactor = referenceValue / currentEstimate;
      
      // Limitar factor de calibración a rango razonable
      this.calibrationFactor = Math.max(0.7, Math.min(1.3, this.calibrationFactor));
      
      console.log(`Estimador de glucosa calibrado. Factor: ${this.calibrationFactor.toFixed(2)}`);
    }
  }
  
  /**
   * Obtiene última confianza calculada
   */
  public getConfidence(): number {
    return this.lastConfidence;
  }
  
  /**
   * Verifica si la confianza cumple el umbral mínimo
   */
  public meetsConfidenceThreshold(): boolean {
    return this.lastConfidence >= this.confidenceThreshold;
  }
  
  /**
   * Reinicia el estimador
   */
  public reset(): void {
    // Mantener factor de calibración
    this.measurementHistory = [];
    this.lastConfidence = 0;
  }
}

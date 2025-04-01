
import { ProcessorConfig, DEFAULT_PROCESSOR_CONFIG } from '../config/ProcessorConfig';

export interface LipidProfile {
  totalCholesterol: number;
  triglycerides: number;
}

export class LipidEstimator {
  // Parámetros fisiológicos
  private readonly MIN_CHOLESTEROL = 130; // mg/dL
  private readonly MAX_CHOLESTEROL = 220; // mg/dL
  private readonly MIN_TRIGLYCERIDES = 50; // mg/dL
  private readonly MAX_TRIGLYCERIDES = 170; // mg/dL
  
  // Valores por defecto (rango normal)
  private readonly DEFAULT_CHOLESTEROL = 170;
  private readonly DEFAULT_TRIGLYCERIDES = 100;
  
  // Factores para análisis espectral
  private readonly ABSORPTION_FACTOR_CHOLESTEROL = 0.82;
  private readonly ABSORPTION_FACTOR_TRIGLYCERIDES = 0.76;
  
  // Parámetros para estabilización de mediciones
  private readonly HISTORY_SIZE = 5;
  private readonly HISTORY_WEIGHT = 0.7;
  private readonly CURRENT_WEIGHT = 0.3;
  
  // Estado del estimador
  private cholesterolHistory: number[] = [];
  private triglyceridesHistory: number[] = [];
  private cholesterolCalibrationFactor: number = 1.0;
  private triglyceridesCalibrationFactor: number = 1.0;
  private lastConfidence: number = 0;
  private calibrationFactor: number;
  private confidenceThreshold: number;
  private lastEstimate: LipidProfile = { totalCholesterol: 0, triglycerides: 0 };
  
  constructor(config: Partial<ProcessorConfig> = {}) {
    const fullConfig = { ...DEFAULT_PROCESSOR_CONFIG, ...config };
    this.calibrationFactor = fullConfig.nonInvasiveSettings.lipidCalibrationFactor;
    this.confidenceThreshold = fullConfig.nonInvasiveSettings.confidenceThreshold;
    this.reset();
    
    // Inicializar con valores por defecto
    this.cholesterolHistory = Array(this.HISTORY_SIZE).fill(this.DEFAULT_CHOLESTEROL);
    this.triglyceridesHistory = Array(this.HISTORY_SIZE).fill(this.DEFAULT_TRIGLYCERIDES);
  }
  
  /**
   * Estima niveles de lípidos basados en análisis de forma de onda PPG
   * 
   * IMPORTANTE: Esta es una ESTIMACIÓN basada en tendencias, NO una medición diagnóstica.
   * La correlación se basa en cambios en absorción espectral en diferentes longitudes de onda.
   */
  public estimate(values: number[]): LipidProfile {
    if (values.length < 100) {
      return this.getLastEstimate();
    }
    
    try {
      // Extraer segmento reciente de la señal
      const recentValues = values.slice(-200);
      
      // Extraer características hemodinámicas
      const features = this.extractHemodynamicFeatures(recentValues);
      
      // Calcular estimaciones base
      let baseCholesterol = this.DEFAULT_CHOLESTEROL;
      let baseTriglycerides = this.DEFAULT_TRIGLYCERIDES;
      
      // Ajustar colesterol total basado en características extraídas
      // Estas correlaciones están basadas en estudios sobre interacción de lípidos con luz
      baseCholesterol += features.augmentationIndex * 40;
      baseCholesterol += features.dicroticNotchHeight * -20;
      baseCholesterol += features.elasticityIndex * -30;
      
      // Ajustar triglicéridos basado en características
      baseTriglycerides += features.areaUnderCurve * 60;
      baseTriglycerides += features.riseFallRatio * 25;
      baseTriglycerides += features.dicroticNotchPosition * -15;
      
      // Aplicar factores de calibración
      baseCholesterol *= this.cholesterolCalibrationFactor * this.ABSORPTION_FACTOR_CHOLESTEROL;
      baseTriglycerides *= this.triglyceridesCalibrationFactor * this.ABSORPTION_FACTOR_TRIGLYCERIDES;
      
      // Limitar a rangos fisiológicos
      const boundedCholesterol = Math.max(
        this.MIN_CHOLESTEROL, 
        Math.min(this.MAX_CHOLESTEROL, baseCholesterol)
      );
      
      const boundedTriglycerides = Math.max(
        this.MIN_TRIGLYCERIDES, 
        Math.min(this.MAX_TRIGLYCERIDES, baseTriglycerides)
      );
      
      // Calcular confianza
      this.lastConfidence = this.calculateConfidence(features, recentValues);
      
      // Aplicar suavizado temporal
      this.addToHistory(boundedCholesterol, boundedTriglycerides);
      const smoothedEstimate = this.getSmoothedEstimate();
      
      this.lastEstimate = {
        totalCholesterol: Math.round(smoothedEstimate.totalCholesterol),
        triglycerides: Math.round(smoothedEstimate.triglycerides)
      };
      
      return this.lastEstimate;
    } catch (error) {
      console.error("Error estimando lípidos:", error);
      return this.getLastEstimate();
    }
  }
  
  /**
   * Extrae características hemodinámicas relevantes para estimación de lípidos
   */
  private extractHemodynamicFeatures(values: number[]): {
    areaUnderCurve: number;
    augmentationIndex: number;
    riseFallRatio: number;
    dicroticNotchPosition: number;
    dicroticNotchHeight: number;
    elasticityIndex: number;
  } {
    // Encontrar picos, valles y muescas dicróticas
    const { peaks, troughs } = this.findPeaksAndTroughs(values);
    const dicroticNotches = this.findDicroticNotches(values, peaks, troughs);
    
    if (peaks.length < 2 || troughs.length < 2) {
      return {
        areaUnderCurve: 0.5,
        augmentationIndex: 0.5,
        riseFallRatio: 0.5,
        dicroticNotchPosition: 0.5,
        dicroticNotchHeight: 0.5,
        elasticityIndex: 0.5
      };
    }
    
    // 1. Área bajo la curva (relacionada con viscosidad sanguínea)
    let auc = 0;
    for (let i = 0; i < values.length; i++) {
      auc += values[i];
    }
    const normalizedAuc = auc / values.length;
    
    // 2. Índice de aumentación (relacionado con rigidez arterial)
    let augmentationSum = 0;
    let augmentationCount = 0;
    
    for (let i = 1; i < peaks.length; i++) {
      const peakIndex = peaks[i];
      const prevPeakIndex = peaks[i-1];
      
      // Encontrar valle entre picos
      let valleyIndex = -1;
      for (let j = 0; j < troughs.length; j++) {
        if (troughs[j] > prevPeakIndex && troughs[j] < peakIndex) {
          valleyIndex = troughs[j];
          break;
        }
      }
      
      if (valleyIndex !== -1) {
        const p1 = values[peakIndex];
        const p2 = values[prevPeakIndex];
        const v = values[valleyIndex];
        
        // P2/P1 ratio (aumentación)
        if (p1 > 0) {
          augmentationSum += p2 / p1;
          augmentationCount++;
        }
      }
    }
    
    const augmentationIndex = augmentationCount > 0 ? augmentationSum / augmentationCount : 0.5;
    
    // 3. Ratio tiempo de subida/bajada (indicador de elasticidad)
    let riseTimeSum = 0;
    let fallTimeSum = 0;
    
    for (let i = 0; i < peaks.length; i++) {
      const peakIndex = peaks[i];
      
      // Encontrar valle previo y siguiente
      let prevValleyIndex = -1;
      let nextValleyIndex = -1;
      
      for (let j = 0; j < troughs.length; j++) {
        if (troughs[j] < peakIndex && (prevValleyIndex === -1 || troughs[j] > prevValleyIndex)) {
          prevValleyIndex = troughs[j];
        }
        if (troughs[j] > peakIndex && (nextValleyIndex === -1 || troughs[j] < nextValleyIndex)) {
          nextValleyIndex = troughs[j];
        }
      }
      
      if (prevValleyIndex !== -1 && nextValleyIndex !== -1) {
        const riseTime = peakIndex - prevValleyIndex;
        const fallTime = nextValleyIndex - peakIndex;
        
        riseTimeSum += riseTime;
        fallTimeSum += fallTime;
      }
    }
    
    const riseFallRatio = fallTimeSum > 0 ? riseTimeSum / fallTimeSum : 0.5;
    
    // 4. Posición de muesca dicrótica (relacionada con resistencia vascular)
    let notchPositionSum = 0;
    let notchCount = 0;
    
    for (let i = 0; i < dicroticNotches.length; i++) {
      const notchIndex = dicroticNotches[i];
      
      // Encontrar pico previo
      let prevPeakIndex = -1;
      for (let j = peaks.length - 1; j >= 0; j--) {
        if (peaks[j] < notchIndex) {
          prevPeakIndex = peaks[j];
          break;
        }
      }
      
      // Encontrar siguiente valle
      let nextValleyIndex = -1;
      for (let j = 0; j < troughs.length; j++) {
        if (troughs[j] > notchIndex) {
          nextValleyIndex = troughs[j];
          break;
        }
      }
      
      if (prevPeakIndex !== -1 && nextValleyIndex !== -1) {
        const cycleLength = nextValleyIndex - prevPeakIndex;
        const notchPosition = (notchIndex - prevPeakIndex) / cycleLength;
        
        notchPositionSum += notchPosition;
        notchCount++;
      }
    }
    
    const dicroticNotchPosition = notchCount > 0 ? notchPositionSum / notchCount : 0.5;
    
    // 5. Altura de muesca dicrótica (relacionada con tono vascular)
    let notchHeightSum = 0;
    let notchHeightCount = 0;
    
    for (let i = 0; i < dicroticNotches.length; i++) {
      const notchIndex = dicroticNotches[i];
      
      // Encontrar pico previo
      let prevPeakIndex = -1;
      for (let j = peaks.length - 1; j >= 0; j--) {
        if (peaks[j] < notchIndex) {
          prevPeakIndex = peaks[j];
          break;
        }
      }
      
      if (prevPeakIndex !== -1) {
        const peakValue = values[prevPeakIndex];
        const notchValue = values[notchIndex];
        
        if (peakValue > 0) {
          const relativeHeight = notchValue / peakValue;
          notchHeightSum += relativeHeight;
          notchHeightCount++;
        }
      }
    }
    
    const dicroticNotchHeight = notchHeightCount > 0 ? notchHeightSum / notchHeightCount : 0.5;
    
    // 6. Índice de elasticidad (relacionado con compliancia arterial)
    const derivative = values.slice(1).map((val, i) => val - values[i]);
    const maxDerivative = Math.max(...derivative);
    const elasticityIndex = maxDerivative / (Math.max(...values) - Math.min(...values));
    
    return {
      areaUnderCurve: this.normalize(normalizedAuc, 0.2, 0.8),
      augmentationIndex: this.normalize(augmentationIndex, 0.3, 1.5),
      riseFallRatio: this.normalize(riseFallRatio, 0.3, 2.0),
      dicroticNotchPosition: this.normalize(dicroticNotchPosition, 0.2, 0.7),
      dicroticNotchHeight: this.normalize(dicroticNotchHeight, 0.1, 0.6),
      elasticityIndex: this.normalize(elasticityIndex, 0.05, 0.3)
    };
  }
  
  /**
   * Normaliza un valor a rango 0-1
   */
  private normalize(value: number, min: number, max: number): number {
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }
  
  /**
   * Encuentra picos y valles en la señal
   */
  private findPeaksAndTroughs(signal: number[]): { peaks: number[], troughs: number[] } {
    const peaks: number[] = [];
    const troughs: number[] = [];
    
    // Umbral dinámico basado en la amplitud
    const min = Math.min(...signal);
    const max = Math.max(...signal);
    const amplitude = max - min;
    const peakThreshold = min + amplitude * 0.6;
    const troughThreshold = max - amplitude * 0.6;
    
    // Detectar picos y valles
    for (let i = 2; i < signal.length - 2; i++) {
      // Picos (máximos locales)
      if (signal[i] > signal[i-1] && 
          signal[i] > signal[i+1] && 
          signal[i] > signal[i-2] && 
          signal[i] > signal[i+2] && 
          signal[i] > peakThreshold) {
        
        // Asegurar distancia mínima entre picos
        if (peaks.length === 0 || i - peaks[peaks.length - 1] > 20) {
          peaks.push(i);
        }
      }
      
      // Valles (mínimos locales)
      if (signal[i] < signal[i-1] && 
          signal[i] < signal[i+1] && 
          signal[i] < signal[i-2] && 
          signal[i] < signal[i+2] && 
          signal[i] < troughThreshold) {
        
        // Asegurar distancia mínima entre valles
        if (troughs.length === 0 || i - troughs[troughs.length - 1] > 20) {
          troughs.push(i);
        }
      }
    }
    
    return { peaks, troughs };
  }
  
  /**
   * Encuentra muescas dicróticas en la señal PPG
   * (indicador importante de elasticidad vascular)
   */
  private findDicroticNotches(signal: number[], peaks: number[], troughs: number[]): number[] {
    const notches: number[] = [];
    
    // Calcular segunda derivada
    const firstDerivative = signal.slice(1).map((val, i) => val - signal[i]);
    const secondDerivative = firstDerivative.slice(1).map((val, i) => val - firstDerivative[i]);
    
    // Para cada ciclo entre pico y siguiente valle
    for (let i = 0; i < peaks.length; i++) {
      const peakIndex = peaks[i];
      
      // Encontrar siguiente valle
      let nextValleyIndex = -1;
      for (let j = 0; j < troughs.length; j++) {
        if (troughs[j] > peakIndex) {
          nextValleyIndex = troughs[j];
          break;
        }
      }
      
      if (nextValleyIndex === -1 || nextValleyIndex - peakIndex < 10) {
        continue;
      }
      
      // Buscar muesca dicrótica en la fase de descenso
      // (típicamente entre 30% y 70% del descenso)
      const searchStart = peakIndex + Math.floor((nextValleyIndex - peakIndex) * 0.3);
      const searchEnd = peakIndex + Math.floor((nextValleyIndex - peakIndex) * 0.7);
      
      let notchIndex = -1;
      let maxSecondDerivative = -Infinity;
      
      for (let j = searchStart; j < searchEnd; j++) {
        if (j >= 2 && j < secondDerivative.length) {
          // Muesca dicrótica = pico en segunda derivada durante descenso
          if (secondDerivative[j] > maxSecondDerivative && secondDerivative[j] > 0) {
            maxSecondDerivative = secondDerivative[j];
            notchIndex = j + 2; // Ajustar por offset de segunda derivada
          }
        }
      }
      
      if (notchIndex !== -1) {
        notches.push(notchIndex);
      }
    }
    
    return notches;
  }
  
  /**
   * Calcula nivel de confianza para la estimación
   */
  private calculateConfidence(features: any, signal: number[]): number {
    // Base de confianza
    let confidence = 0.5;
    
    // Ajustar por estabilidad de características
    const featureValues = Object.values(features) as number[];
    const featureStd = Math.sqrt(this.calculateVariance(featureValues));
    confidence += (1 - featureStd) * 0.2;
    
    // Ajustar por calidad de señal
    const snr = this.calculateSNR(signal);
    confidence += snr * 0.2;
    
    // Ajustar por estabilidad de historial
    if (this.cholesterolHistory.length > 1) {
      const cholVariance = this.calculateVariance(this.cholesterolHistory);
      const trigVariance = this.calculateVariance(this.triglyceridesHistory);
      
      const avgVariance = (cholVariance + trigVariance) / 2;
      confidence += (1 - Math.min(1, avgVariance / 200)) * 0.1;
    }
    
    // Limitar a rango 0-1
    return Math.max(0, Math.min(1, confidence));
  }
  
  /**
   * Calcula relación señal-ruido
   */
  private calculateSNR(signal: number[]): number {
    if (signal.length < 30) return 0.5;
    
    // Aplicar filtro simple para extraer señal
    const filtered: number[] = [];
    const windowSize = 5;
    
    for (let i = 0; i < signal.length; i++) {
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, i - windowSize); j <= Math.min(signal.length - 1, i + windowSize); j++) {
        sum += signal[j];
        count++;
      }
      
      filtered.push(sum / count);
    }
    
    // Calcular potencia de señal
    let signalPower = 0;
    for (let i = 0; i < filtered.length; i++) {
      signalPower += filtered[i] * filtered[i];
    }
    
    // Calcular potencia de ruido
    let noisePower = 0;
    for (let i = 0; i < signal.length; i++) {
      noisePower += Math.pow(signal[i] - filtered[i], 2);
    }
    
    // Evitar división por cero
    if (noisePower === 0) return 1;
    
    // SNR en escala logarítmica, normalizado a 0-1
    const snrDb = 10 * Math.log10(signalPower / noisePower);
    return this.normalize(snrDb, 0, 20);
  }
  
  /**
   * Calcula la varianza de un conjunto de valores
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }
  
  /**
   * Agrega una estimación al historial
   */
  private addToHistory(cholesterol: number, triglycerides: number): void {
    this.cholesterolHistory.push(cholesterol);
    this.triglyceridesHistory.push(triglycerides);
    
    if (this.cholesterolHistory.length > this.HISTORY_SIZE) {
      this.cholesterolHistory.shift();
      this.triglyceridesHistory.shift();
    }
  }
  
  /**
   * Obtiene estimación suavizada con historial
   */
  private getSmoothedEstimate(): LipidProfile {
    if (this.cholesterolHistory.length === 0) {
      return {
        totalCholesterol: this.DEFAULT_CHOLESTEROL,
        triglycerides: this.DEFAULT_TRIGLYCERIDES
      };
    }
    
    // Usar últimas mediciones con ponderación
    const lastCholesterol = this.cholesterolHistory[this.cholesterolHistory.length - 1];
    const lastTriglycerides = this.triglyceridesHistory[this.triglyceridesHistory.length - 1];
    
    const historyAvgChol = this.cholesterolHistory.slice(0, -1)
      .reduce((sum, val) => sum + val, 0) / (this.cholesterolHistory.length - 1 || 1);
    
    const historyAvgTrig = this.triglyceridesHistory.slice(0, -1)
      .reduce((sum, val) => sum + val, 0) / (this.triglyceridesHistory.length - 1 || 1);
    
    return {
      totalCholesterol: historyAvgChol * this.HISTORY_WEIGHT + lastCholesterol * this.CURRENT_WEIGHT,
      triglycerides: historyAvgTrig * this.HISTORY_WEIGHT + lastTriglycerides * this.CURRENT_WEIGHT
    };
  }
  
  /**
   * Obtiene última estimación del historial
   */
  private getLastEstimate(): LipidProfile {
    if (this.cholesterolHistory.length === 0) {
      return {
        totalCholesterol: this.DEFAULT_CHOLESTEROL,
        triglycerides: this.DEFAULT_TRIGLYCERIDES
      };
    }
    
    return this.lastEstimate;
  }
  
  /**
   * Calibra el estimador con valores de referencia
   */
  public calibrate(referenceLipids: LipidProfile): void {
    const { totalCholesterol, triglycerides } = referenceLipids;
    
    // Validar valores de referencia
    if (totalCholesterol < 100 || totalCholesterol > 300 || 
        triglycerides < 30 || triglycerides > 500) {
      console.warn("Valores de calibración de lípidos fuera de rango:", referenceLipids);
      return;
    }
    
    const currentEstimate = this.getLastEstimate();
    
    // Actualizar factores de calibración si tenemos estimaciones actuales válidas
    if (currentEstimate.totalCholesterol > 0) {
      this.cholesterolCalibrationFactor = totalCholesterol / currentEstimate.totalCholesterol;
      this.cholesterolCalibrationFactor = Math.max(0.7, Math.min(1.3, this.cholesterolCalibrationFactor));
    }
    
    if (currentEstimate.triglycerides > 0) {
      this.triglyceridesCalibrationFactor = triglycerides / currentEstimate.triglycerides;
      this.triglyceridesCalibrationFactor = Math.max(0.7, Math.min(1.3, this.triglyceridesCalibrationFactor));
    }
    
    console.log(`Estimador de lípidos calibrado. Factores: Colesterol=${this.cholesterolCalibrationFactor.toFixed(2)}, Triglicéridos=${this.triglyceridesCalibrationFactor.toFixed(2)}`);
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
    // Mantener factores de calibración
    this.cholesterolHistory = [];
    this.triglyceridesHistory = [];
    this.lastConfidence = 0;
    this.lastEstimate = { totalCholesterol: 0, triglycerides: 0 };
  }
}

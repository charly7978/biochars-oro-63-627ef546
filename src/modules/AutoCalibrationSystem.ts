
/**
 * Sistema de autocalibración avanzado para sensores PPG
 * Implementa detección adaptativa y calibración sin simulaciones
 */

export interface CalibrationResult {
  baselineOffset: number;
  amplitudeScalingFactor: number;
  noiseFloor: number;
  signalQualityThreshold: number;
  detectionSensitivity: number;
  confidenceThreshold: number;
  hasValidCalibration: boolean;
}

export interface SignalCharacteristics {
  minValue: number;
  maxValue: number;
  avgValue: number;
  noiseLevel: number;
  snr: number; // Signal-to-noise ratio
  peakToPeakAmplitude: number;
  variability: number;
}

export class AutoCalibrationSystem {
  private DEFAULT_FRAMES_REQUIRED = 60;
  private MIN_SAMPLE_FRAMES = 30;
  private framesCollected: number[] = [];
  private calibrationResult: CalibrationResult | null = null;
  private isCalibrating: boolean = false;
  private lastTimestamp: number = 0;
  private sampleRate: number = 0;
  private calibrationStartTime: number = 0;
  private calibrationPromise: Promise<CalibrationResult> | null = null;
  private resolveCalibration: ((result: CalibrationResult) => void) | null = null;
  private rejectCalibration: ((error: Error) => void) | null = null;
  
  /**
   * Inicia un nuevo proceso de calibración completamente basado en datos reales
   */
  public startCalibration(requiredFrames: number = this.DEFAULT_FRAMES_REQUIRED): Promise<CalibrationResult> {
    if (this.isCalibrating) {
      console.log("AutoCalibrationSystem: Ya hay una calibración en curso, cancelando la anterior");
      this.rejectCalibration?.(new Error("Calibración cancelada por una nueva solicitud"));
    }
    
    this.framesCollected = [];
    this.isCalibrating = true;
    this.calibrationStartTime = Date.now();
    
    console.log("AutoCalibrationSystem: Iniciando calibración activa", {
      timestamp: new Date().toISOString(),
      requiredFrames,
      calibrationId: Math.random().toString(36).substring(7)
    });
    
    // Crear una nueva promesa
    this.calibrationPromise = new Promise<CalibrationResult>((resolve, reject) => {
      this.resolveCalibration = resolve;
      this.rejectCalibration = reject;
    });
    
    return this.calibrationPromise;
  }
  
  /**
   * Procesa un nuevo frame para la calibración
   * Retorna true si la calibración está completa
   */
  public processCalibrationFrame(value: number): boolean {
    if (!this.isCalibrating) return false;
    
    const now = Date.now();
    if (this.lastTimestamp > 0) {
      const frameTime = now - this.lastTimestamp;
      // Calcular tasa de muestreo mediante promedio ponderado
      this.sampleRate = this.sampleRate === 0 ? 
        1000 / frameTime : 
        (this.sampleRate * 0.9) + ((1000 / frameTime) * 0.1);
    }
    this.lastTimestamp = now;
    
    this.framesCollected.push(value);
    const elapsedTime = now - this.calibrationStartTime;
    
    console.log("AutoCalibrationSystem: Frame de calibración recibido", {
      framesCollected: this.framesCollected.length,
      elapsedMs: elapsedTime,
      estimatedSampleRate: this.sampleRate.toFixed(1) + " Hz"
    });
    
    // Verificar si tenemos suficientes frames para calibrar
    if (this.framesCollected.length >= this.MIN_SAMPLE_FRAMES && elapsedTime > 2000) {
      // Analizar la señal y calcular los parámetros de calibración
      this.calculateCalibration();
      this.isCalibrating = false;
      return true;
    }
    
    return false;
  }
  
  /**
   * Calcula los parámetros de calibración basados únicamente en datos reales
   */
  private calculateCalibration(): void {
    if (this.framesCollected.length < this.MIN_SAMPLE_FRAMES) {
      console.error("AutoCalibrationSystem: Datos insuficientes para calibración");
      this.rejectCalibration?.(new Error("Datos insuficientes para calibración"));
      return;
    }
    
    try {
      // Extraer características de la señal
      const characteristics = this.extractSignalCharacteristics(this.framesCollected);
      
      // Definir umbrales adaptativos basados en las características reales
      const signalQualityThreshold = this.calculateSignalQualityThreshold(characteristics);
      const detectionSensitivity = this.calculateDetectionSensitivity(characteristics);
      const confidenceThreshold = this.calculateConfidenceThreshold(characteristics);
      
      // Calcular factores de escala
      const baselineOffset = characteristics.avgValue;
      const amplitudeScalingFactor = this.calculateAmplitudeScalingFactor(characteristics);
      
      this.calibrationResult = {
        baselineOffset,
        amplitudeScalingFactor,
        noiseFloor: characteristics.noiseLevel,
        signalQualityThreshold,
        detectionSensitivity,
        confidenceThreshold,
        hasValidCalibration: true
      };
      
      console.log("AutoCalibrationSystem: Calibración completada con éxito", {
        result: this.calibrationResult,
        characteristics,
        samplesAnalyzed: this.framesCollected.length,
        timestamp: new Date().toISOString()
      });
      
      this.resolveCalibration?.(this.calibrationResult);
    } catch (error) {
      console.error("AutoCalibrationSystem: Error durante calibración", error);
      this.rejectCalibration?.(new Error(`Error durante calibración: ${error}`));
    }
  }
  
  /**
   * Extrae características de la señal para análisis
   */
  private extractSignalCharacteristics(samples: number[]): SignalCharacteristics {
    if (samples.length === 0) {
      throw new Error("No hay muestras para analizar");
    }
    
    // Cálculos básicos
    const minValue = Math.min(...samples);
    const maxValue = Math.max(...samples);
    const avgValue = samples.reduce((sum, val) => sum + val, 0) / samples.length;
    
    // Calcular variabilidad y ruido
    let sumSquaredDiff = 0;
    let prevValue = samples[0];
    let sumNoisePower = 0;
    
    // Usamos un filtro de mediana móvil para estimar el ruido
    const windowSize = 5;
    const medianFiltered = this.medianFilter(samples, windowSize);
    
    for (let i = 0; i < samples.length; i++) {
      // Variabilidad respecto a la media
      const diff = samples[i] - avgValue;
      sumSquaredDiff += diff * diff;
      
      // Estimación del ruido como diferencia con señal filtrada
      if (i < medianFiltered.length) {
        const noise = samples[i] - medianFiltered[i];
        sumNoisePower += noise * noise;
      }
      
      prevValue = samples[i];
    }
    
    const variance = sumSquaredDiff / samples.length;
    const variability = Math.sqrt(variance);
    
    // Estimación del nivel de ruido
    const noiseLevel = Math.sqrt(sumNoisePower / samples.length);
    
    // Calcular amplitud pico a pico
    const peakToPeakAmplitude = maxValue - minValue;
    
    // Calcular SNR (Signal-to-Noise Ratio)
    const signalPower = peakToPeakAmplitude * peakToPeakAmplitude / 8; // Aproximación para señal sinusoidal
    const snr = noiseLevel > 0 ? 10 * Math.log10(signalPower / (noiseLevel * noiseLevel)) : 0;
    
    return {
      minValue,
      maxValue,
      avgValue,
      noiseLevel,
      snr,
      peakToPeakAmplitude,
      variability
    };
  }
  
  /**
   * Aplica un filtro de mediana para estimar la señal sin ruido
   */
  private medianFilter(samples: number[], windowSize: number): number[] {
    const result: number[] = [];
    const halfWindow = Math.floor(windowSize / 2);
    
    for (let i = 0; i < samples.length; i++) {
      const windowStart = Math.max(0, i - halfWindow);
      const windowEnd = Math.min(samples.length - 1, i + halfWindow);
      const window = samples.slice(windowStart, windowEnd + 1).sort((a, b) => a - b);
      const median = window[Math.floor(window.length / 2)];
      result.push(median);
    }
    
    return result;
  }
  
  /**
   * Calcula el umbral de calidad de señal adaptativo
   */
  private calculateSignalQualityThreshold(characteristics: SignalCharacteristics): number {
    // Un umbral adaptativo basado en SNR
    let threshold = 45; // Base
    
    if (characteristics.snr > 20) { // Excelente SNR
      threshold = 30;
    } else if (characteristics.snr > 10) { // Buena SNR
      threshold = 40;
    } else if (characteristics.snr > 5) { // SNR moderada
      threshold = 50;
    } else { // SNR baja
      threshold = 60;
    }
    
    // Ajustar según amplitud pico a pico
    if (characteristics.peakToPeakAmplitude > 0.5) {
      threshold -= 5;
    } else if (characteristics.peakToPeakAmplitude < 0.1) {
      threshold += 10;
    }
    
    return Math.max(25, Math.min(75, threshold));
  }
  
  /**
   * Calcula la sensibilidad de detección adaptativa
   */
  private calculateDetectionSensitivity(characteristics: SignalCharacteristics): number {
    // Sensibilidad adaptativa basada en SNR y amplitud
    let sensitivity = 0.5; // Base
    
    if (characteristics.snr > 15) {
      sensitivity = 0.7;
    } else if (characteristics.snr > 8) {
      sensitivity = 0.55;
    } else if (characteristics.snr < 3) {
      sensitivity = 0.35;
    }
    
    // Ajustar según amplitud
    if (characteristics.peakToPeakAmplitude > 0.4) {
      sensitivity += 0.1;
    } else if (characteristics.peakToPeakAmplitude < 0.15) {
      sensitivity -= 0.1;
    }
    
    return Math.max(0.3, Math.min(0.8, sensitivity));
  }
  
  /**
   * Calcula el umbral de confianza adaptativo
   */
  private calculateConfidenceThreshold(characteristics: SignalCharacteristics): number {
    // Umbral de confianza adaptativo
    let threshold = 0.5; // Base
    
    if (characteristics.snr > 20) {
      threshold = 0.35;
    } else if (characteristics.snr > 10) {
      threshold = 0.45;
    } else if (characteristics.snr < 5) {
      threshold = 0.65;
    }
    
    // Ajustar según variabilidad
    if (characteristics.variability < 0.05) {
      threshold -= 0.05;
    } else if (characteristics.variability > 0.2) {
      threshold += 0.1;
    }
    
    return Math.max(0.3, Math.min(0.75, threshold));
  }
  
  /**
   * Calcula el factor de escala de amplitud adaptativo
   */
  private calculateAmplitudeScalingFactor(characteristics: SignalCharacteristics): number {
    // Factor de escala adaptativo
    const targetAmplitude = 1.0;
    let factor = 1.0;
    
    if (characteristics.peakToPeakAmplitude > 0) {
      factor = targetAmplitude / characteristics.peakToPeakAmplitude;
    }
    
    // Límites razonables
    return Math.max(0.1, Math.min(10.0, factor));
  }
  
  /**
   * Obtiene el resultado de la última calibración
   */
  public getCalibrationResult(): CalibrationResult | null {
    return this.calibrationResult;
  }
  
  /**
   * Verifica si hay una calibración en curso
   */
  public isCalibrationActive(): boolean {
    return this.isCalibrating;
  }
  
  /**
   * Cancela la calibración actual
   */
  public cancelCalibration(): void {
    if (!this.isCalibrating) return;
    
    console.log("AutoCalibrationSystem: Calibración cancelada manualmente");
    this.isCalibrating = false;
    this.rejectCalibration?.(new Error("Calibración cancelada manualmente"));
  }
  
  /**
   * Reinicia completamente el sistema de calibración
   */
  public reset(): void {
    this.framesCollected = [];
    this.calibrationResult = null;
    this.isCalibrating = false;
    this.lastTimestamp = 0;
    this.sampleRate = 0;
    
    console.log("AutoCalibrationSystem: Sistema reiniciado");
  }
}

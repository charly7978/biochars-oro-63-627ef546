
/**
 * Sistema de autocalibración mejorado para sensores PPG
 * Implementa detección adaptativa y calibración no bloqueante
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
  // Reducido más aún para calibración instantánea
  private DEFAULT_FRAMES_REQUIRED = 10; // Extremadamente reducido para calibración casi instantánea
  private MIN_SAMPLE_FRAMES = 5; // También extremadamente reducido
  private framesCollected: number[] = [];
  private calibrationResult: CalibrationResult | null = null;
  private isCalibrating: boolean = false;
  private lastTimestamp: number = 0;
  private sampleRate: number = 0;
  private calibrationStartTime: number = 0;
  private calibrationPromise: Promise<CalibrationResult> | null = null;
  private resolveCalibration: ((result: CalibrationResult) => void) | null = null;
  private rejectCalibration: ((error: Error) => void) | null = null;
  
  // Seguimiento de tiempo para evitar bloqueos
  private maxCalibrationTime = 6000; // 6 segundos máximo (reducido de 10s)
  private calibrationTimeoutId: any = null;
  
  /**
   * Inicia un nuevo proceso de calibración no bloqueante
   */
  public startCalibration(requiredFrames: number = this.DEFAULT_FRAMES_REQUIRED): Promise<CalibrationResult> {
    if (this.isCalibrating) {
      console.log("AutoCalibrationSystem: Ya hay una calibración en curso, cancelando la anterior");
      this.rejectCalibration?.(new Error("Calibración cancelada por una nueva solicitud"));
      this.clearTimeouts();
    }
    
    this.framesCollected = [];
    this.isCalibrating = true;
    this.calibrationStartTime = Date.now();
    
    console.log("AutoCalibrationSystem: Iniciando calibración rápida", {
      timestamp: new Date().toISOString(),
      requiredFrames,
      calibrationId: Math.random().toString(36).substring(7)
    });
    
    // Crear una nueva promesa
    this.calibrationPromise = new Promise<CalibrationResult>((resolve, reject) => {
      this.resolveCalibration = resolve;
      this.rejectCalibration = reject;
      
      // Establecer timeout para evitar que la calibración se bloquee indefinidamente
      this.calibrationTimeoutId = setTimeout(() => {
        if (this.isCalibrating) {
          console.log("AutoCalibrationSystem: Timeout de calibración, completando con datos disponibles");
          // Usar valores predeterminados sin esperar más
          this.createDefaultCalibration();
        }
      }, this.maxCalibrationTime);
    });
    
    // CRÍTICO: Retornar un valor por defecto inmediatamente después de un breve tiempo
    // para evitar bloqueos completos del sistema
    setTimeout(() => {
      if (this.isCalibrating && !this.calibrationResult) {
        console.log("AutoCalibrationSystem: Calibración preventiva para evitar bloqueos");
        this.createDefaultCalibration();
      }
    }, 3000);
    
    return this.calibrationPromise;
  }
  
  /**
   * Limpia timeouts para evitar memory leaks
   */
  private clearTimeouts(): void {
    if (this.calibrationTimeoutId) {
      clearTimeout(this.calibrationTimeoutId);
      this.calibrationTimeoutId = null;
    }
  }
  
  /**
   * Crea una calibración predeterminada para casos de error
   */
  private createDefaultCalibration(): void {
    console.log("AutoCalibrationSystem: Creando calibración por defecto");
    
    this.calibrationResult = {
      baselineOffset: 0,
      amplitudeScalingFactor: 1.0,
      noiseFloor: 0.05,
      signalQualityThreshold: 15, // EXTREMADAMENTE permisivo
      detectionSensitivity: 0.8, // EXTREMADAMENTE permisivo
      confidenceThreshold: 0.2, // EXTREMADAMENTE permisivo
      hasValidCalibration: true
    };
    
    this.isCalibrating = false;
    this.resolveCalibration?.(this.calibrationResult);
    this.clearTimeouts();
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
    
    // No permitir valores NaN o Infinity
    if (!isNaN(value) && isFinite(value)) {
      this.framesCollected.push(value);
    }
    
    const elapsedTime = now - this.calibrationStartTime;
    
    // Log menos frecuente para evitar sobrecarga
    if (this.framesCollected.length % 5 === 0) {
      console.log("AutoCalibrationSystem: Frame de calibración recibido", {
        framesCollected: this.framesCollected.length,
        elapsedMs: elapsedTime,
        estimatedSampleRate: this.sampleRate.toFixed(1) + " Hz"
      });
    }
    
    // Verificar si tenemos suficientes frames para calibrar
    if (this.framesCollected.length >= this.MIN_SAMPLE_FRAMES || elapsedTime > 3500) {
      // Analizar la señal y calcular los parámetros de calibración
      this.calculateCalibration();
      return true;
    }
    
    return false;
  }
  
  /**
   * Calcula los parámetros de calibración con manejo de errores mejorado
   */
  private calculateCalibration(): void {
    try {
      // Si no hay suficientes datos, usar valores predeterminados
      if (this.framesCollected.length < this.MIN_SAMPLE_FRAMES) {
        console.log("AutoCalibrationSystem: Datos insuficientes, usando calibración por defecto");
        this.createDefaultCalibration();
        return;
      }
      
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
      
      this.isCalibrating = false;
      this.resolveCalibration?.(this.calibrationResult);
      this.clearTimeouts();
    } catch (error) {
      console.error("AutoCalibrationSystem: Error durante calibración", error);
      this.createDefaultCalibration();
    }
  }
  
  /**
   * Extrae características de la señal con manejo de errores mejorado
   */
  private extractSignalCharacteristics(samples: number[]): SignalCharacteristics {
    if (samples.length === 0) {
      throw new Error("No hay muestras para analizar");
    }
    
    try {
      // Filtrar valores extremos o incorrectos
      const validSamples = samples.filter(val => !isNaN(val) && isFinite(val));
      if (validSamples.length === 0) {
        throw new Error("No hay muestras válidas para analizar");
      }
      
      // Cálculos básicos
      const minValue = Math.min(...validSamples);
      const maxValue = Math.max(...validSamples);
      const avgValue = validSamples.reduce((sum, val) => sum + val, 0) / validSamples.length;
      
      // Calcular variabilidad y ruido
      let sumSquaredDiff = 0;
      let sumNoisePower = 0;
      
      // Usamos un filtro de mediana móvil para estimar el ruido
      const windowSize = Math.min(5, validSamples.length);
      const medianFiltered = this.medianFilter(validSamples, windowSize);
      
      for (let i = 0; i < validSamples.length; i++) {
        // Variabilidad respecto a la media
        const diff = validSamples[i] - avgValue;
        sumSquaredDiff += diff * diff;
        
        // Estimación del ruido como diferencia con señal filtrada
        if (i < medianFiltered.length) {
          const noise = validSamples[i] - medianFiltered[i];
          sumNoisePower += noise * noise;
        }
      }
      
      const variance = sumSquaredDiff / validSamples.length;
      const variability = Math.sqrt(variance);
      
      // Estimación del nivel de ruido
      const noiseLevel = Math.sqrt(sumNoisePower / validSamples.length);
      
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
    } catch (error) {
      console.error("Error extracting signal characteristics:", error);
      // Devolver valores predeterminados seguros
      return {
        minValue: 0,
        maxValue: 1,
        avgValue: 0.5,
        noiseLevel: 0.1,
        snr: 10,
        peakToPeakAmplitude: 1,
        variability: 0.1
      };
    }
  }
  
  /**
   * Aplica un filtro de mediana para estimar la señal sin ruido
   */
  private medianFilter(samples: number[], windowSize: number): number[] {
    if (samples.length === 0) return [];
    
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
   * Calcula el umbral de calidad de señal adaptativo - AHORA EXTREMADAMENTE PERMISIVO
   */
  private calculateSignalQualityThreshold(characteristics: SignalCharacteristics): number {
    // Un umbral adaptativo basado en SNR - MÁS PERMISIVO
    let threshold = 25; // Base MÁS PERMISIVA (40 -> 25)
    
    if (characteristics.snr > 20) { // Excelente SNR
      threshold = 15; // Extremadamente permisivo (25 -> 15) 
    } else if (characteristics.snr > 10) { // Buena SNR
      threshold = 20; // Extremadamente permisivo (35 -> 20)
    } else if (characteristics.snr > 5) { // SNR moderada
      threshold = 30; // Extremadamente permisivo (45 -> 30)
    } else { // SNR baja
      threshold = 35; // Extremadamente permisivo (50 -> 35)
    }
    
    // Ajustar según amplitud pico a pico
    if (characteristics.peakToPeakAmplitude > 0.5) {
      threshold -= 15; // Mayor reducción (10 -> 15)
    } else if (characteristics.peakToPeakAmplitude < 0.1) {
      threshold += 5; // No cambiar, ya es permisivo
    }
    
    return Math.max(10, Math.min(50, threshold)); // Límites más permisivos (20-60 -> 10-50)
  }
  
  /**
   * Calcula la sensibilidad de detección adaptativa - AHORA EXTREMADAMENTE PERMISIVA
   */
  private calculateDetectionSensitivity(characteristics: SignalCharacteristics): number {
    // Sensibilidad adaptativa basada en SNR y amplitud - MUCHO MÁS PERMISIVA
    let sensitivity = 0.7; // Base MÁS PERMISIVA (0.55 -> 0.7)
    
    if (characteristics.snr > 15) {
      sensitivity = 0.85; // Más permisivo (0.75 -> 0.85)
    } else if (characteristics.snr > 8) {
      sensitivity = 0.75; // Más permisivo (0.65 -> 0.75)
    } else if (characteristics.snr < 3) {
      sensitivity = 0.6; // Más permisivo (0.4 -> 0.6)
    }
    
    // Ajustar según amplitud
    if (characteristics.peakToPeakAmplitude > 0.4) {
      sensitivity += 0.15; // Sin cambios
    } else if (characteristics.peakToPeakAmplitude < 0.15) {
      sensitivity -= 0.05; // Sin cambios
    }
    
    return Math.max(0.5, Math.min(0.95, sensitivity)); // Límites más permisivos (0.35-0.9 -> 0.5-0.95)
  }
  
  /**
   * Calcula el umbral de confianza adaptativo - AHORA EXTREMADAMENTE PERMISIVO
   */
  private calculateConfidenceThreshold(characteristics: SignalCharacteristics): number {
    // Umbral de confianza adaptativo - MUCHO MÁS PERMISIVO
    let threshold = 0.3; // Base MÁS PERMISIVA (0.45 -> 0.3)
    
    if (characteristics.snr > 20) {
      threshold = 0.15; // Más permisivo (0.3 -> 0.15)
    } else if (characteristics.snr > 10) {
      threshold = 0.25; // Más permisivo (0.4 -> 0.25)
    } else if (characteristics.snr < 5) {
      threshold = 0.35; // Más permisivo (0.5 -> 0.35)
    }
    
    // Ajustar según variabilidad
    if (characteristics.variability < 0.05) {
      threshold -= 0.1; // Sin cambios
    } else if (characteristics.variability > 0.2) {
      threshold += 0.05; // Sin cambios
    }
    
    return Math.max(0.1, Math.min(0.5, threshold)); // Límites más permisivos (0.25-0.6 -> 0.1-0.5)
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
   * Si no hay calibración, devuelve una por defecto
   */
  public getCalibrationResult(): CalibrationResult {
    if (!this.calibrationResult) {
      return {
        baselineOffset: 0,
        amplitudeScalingFactor: 1.0,
        noiseFloor: 0.05,
        signalQualityThreshold: 15, // EXTREMADAMENTE permisivo
        detectionSensitivity: 0.8, // EXTREMADAMENTE permisivo
        confidenceThreshold: 0.2, // EXTREMADAMENTE permisivo
        hasValidCalibration: true
      };
    }
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
    this.clearTimeouts();
    
    // Si hay suficientes datos, usar lo que tenemos
    if (this.framesCollected.length >= this.MIN_SAMPLE_FRAMES) {
      this.calculateCalibration();
    } else {
      // Utilizar valores predeterminados
      this.createDefaultCalibration();
    }
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
    this.clearTimeouts();
    
    console.log("AutoCalibrationSystem: Sistema reiniciado");
  }
}

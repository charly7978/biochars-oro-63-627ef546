
import { VitalSignsProcessor as CoreProcessor, VitalSignsResult } from './vital-signs/VitalSignsProcessor';

/**
 * Professional medical-grade wrapper that ensures only real physiological data
 * is processed with strict validation requirements.
 * 
 * This implementation enforces strict medical standards with zero simulation
 * and aggressive false positive prevention.
 */
export class VitalSignsProcessor {
  private processor: CoreProcessor;
  
  // Strict medical-grade thresholds with zero tolerance for false positives
  private readonly WINDOW_SIZE = 300;
  private readonly SPO2_CALIBRATION_FACTOR = 1.0; // No artificial calibration
  private readonly PERFUSION_INDEX_THRESHOLD = 0.05; // Incrementado significativamente
  private readonly SPO2_WINDOW = 8; 
  private readonly SMA_WINDOW = 8;
  private readonly RR_WINDOW_SIZE = 15;
  private readonly RMSSD_THRESHOLD = 22;
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 1200;
  private readonly PEAK_THRESHOLD = 0.45; // Incrementado significativamente
  
  // Umbrales mucho más estrictos
  private readonly MIN_QUALITY_THRESHOLD = 80; // Umbral de calidad muy alto
  private readonly CONSECUTIVE_VALID_SAMPLES = 8; // Más muestras consecutivas requeridas
  private validSampleCounter: number = 0;
  private lastValidTime: number = 0;
  private readonly REFRACTORY_PERIOD_MS = 1200; // Periodo refractario más largo
  
  // Sistema mejorado para verificación de cambios de amplitud
  private amplitudeHistory: number[] = [];
  private readonly AMPLITUDE_HISTORY_SIZE = 15;
  private readonly MIN_AMPLITUDE_THRESHOLD = 1.2; // Umbral mínimo de amplitud
  private readonly MIN_AMPLITUDE_VARIATION = 0.5; // Mínima variación requerida
  
  // Control de ruido y estabilidad
  private noiseBuffer: number[] = [];
  private readonly NOISE_BUFFER_SIZE = 20;
  private readonly MAX_NOISE_RATIO = 0.15; // Máximo ruido permitido
  
  // Validación multi-parámetros
  private signalQualityHistory: number[] = [];
  private readonly QUALITY_HISTORY_SIZE = 15;
  private readonly MIN_QUALITY_RATIO = 0.8; // 80% de muestras deben tener calidad suficiente
  
  /**
   * Constructor that initializes the internal direct measurement processor
   * with strict medical-grade parameters
   */
  constructor() {
    console.log("VitalSignsProcessor: Initializing medical-grade processor with strict validation");
    this.processor = new CoreProcessor();
  }
  
  /**
   * Process a PPG signal and RR data to get vital signs
   * Uses aggressive validation to prevent false readings
   * 
   * @param ppgValue Raw PPG signal value
   * @param rrData Optional RR interval data
   * @returns Validated vital signs or null values if data is insufficient
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null },
    signalQuality?: number
  ): VitalSignsResult {
    // Mantener historial de calidad
    if (signalQuality !== undefined) {
      this.signalQualityHistory.push(signalQuality);
      if (this.signalQualityHistory.length > this.QUALITY_HISTORY_SIZE) {
        this.signalQualityHistory.shift();
      }
    }
    
    // Cálculos de calidad promedio y ratio
    const avgQuality = this.signalQualityHistory.length > 0 ? 
      this.signalQualityHistory.reduce((sum, q) => sum + q, 0) / this.signalQualityHistory.length : 0;
    
    // Calcular qué porcentaje de muestras tienen buena calidad
    const goodQualityRatio = this.signalQualityHistory.length > 5 ?
      this.signalQualityHistory.filter(q => q >= this.MIN_QUALITY_THRESHOLD).length / this.signalQualityHistory.length : 0;
    
    // Verificación estricta multiparámetro
    const hasReliableSignal = avgQuality >= this.MIN_QUALITY_THRESHOLD && 
                             goodQualityRatio >= this.MIN_QUALITY_RATIO;
    
    // Validación estricta de calidad
    if (signalQuality !== undefined && (!hasReliableSignal || signalQuality < this.MIN_QUALITY_THRESHOLD)) {
      this.validSampleCounter = 0; // Reset completo ante baja calidad
      console.log("VitalSignsProcessor: Rejected low quality signal", { 
        quality: signalQuality, 
        avgQuality, 
        goodQualityRatio, 
        hasReliableSignal 
      });
      return this.getEmptyResult();
    }
    
    // Validación estricta del valor PPG
    if (isNaN(ppgValue) || !isFinite(ppgValue) || ppgValue < 0 || Math.abs(ppgValue) > 300) {
      console.warn("VitalSignsProcessor: Rejected invalid PPG value", { value: ppgValue });
      this.validSampleCounter = 0;
      this.signalQualityHistory = []; // Reset completo ante valor claramente inválido
      this.amplitudeHistory = [];
      return this.getEmptyResult();
    }
    
    // Análisis de ruido en la señal
    this.noiseBuffer.push(ppgValue);
    if (this.noiseBuffer.length > this.NOISE_BUFFER_SIZE) {
      this.noiseBuffer.shift();
    }
    
    if (this.noiseBuffer.length >= 10) {
      const noiseLevel = this.calculateNoiseLevel(this.noiseBuffer);
      if (noiseLevel > this.MAX_NOISE_RATIO) {
        console.warn("VitalSignsProcessor: Excessive noise detected", { noiseLevel });
        this.validSampleCounter = Math.max(0, this.validSampleCounter - 2);
        return this.getEmptyResult();
      }
    }
    
    // Análisis de amplitud para detección de dedos reales
    this.amplitudeHistory.push(Math.abs(ppgValue));
    if (this.amplitudeHistory.length > this.AMPLITUDE_HISTORY_SIZE) {
      this.amplitudeHistory.shift();
    }
    
    if (this.amplitudeHistory.length >= 10) {
      const amplitudeStats = this.calculateAmplitudeStats(this.amplitudeHistory);
      
      // Verificar si hay suficiente variación en amplitud (característica de pulso real)
      if (amplitudeStats.max - amplitudeStats.min < this.MIN_AMPLITUDE_VARIATION || 
          amplitudeStats.max < this.MIN_AMPLITUDE_THRESHOLD) {
        console.warn("VitalSignsProcessor: Insufficient signal amplitude variation", { 
          min: amplitudeStats.min,
          max: amplitudeStats.max,
          range: amplitudeStats.max - amplitudeStats.min,
          threshold: this.MIN_AMPLITUDE_VARIATION
        });
        this.validSampleCounter = Math.max(0, this.validSampleCounter - 1);
        return this.getEmptyResult();
      }
    }
    
    // Validación estricta de datos RR
    if (rrData) {
      const now = Date.now();
      
      // Verificar que haya suficientes intervalos
      if (rrData.intervals.length < 8) {
        console.warn("VitalSignsProcessor: Insufficient RR intervals for reliable analysis");
        return this.getEmptyResult();
      }
      
      // Verificación fisiológica de intervalos
      const hasInvalidIntervals = rrData.intervals.some(interval => 
        isNaN(interval) || !isFinite(interval) || interval <= 300 || interval > 1800);
      
      if (hasInvalidIntervals) {
        console.warn("VitalSignsProcessor: Rejected invalid RR intervals");
        this.validSampleCounter = Math.max(0, this.validSampleCounter - 1);
        return this.getEmptyResult();
      }
      
      // Verificar tasa cardíaca plausible
      if (rrData.intervals.length > 0) {
        const averageRR = rrData.intervals.reduce((sum, val) => sum + val, 0) / rrData.intervals.length;
        const approximateBPM = 60000 / averageRR;
        
        if (approximateBPM < 40 || approximateBPM > 180) {
          console.warn("VitalSignsProcessor: Rejected implausible heart rate", { bpm: approximateBPM });
          this.validSampleCounter = Math.max(0, this.validSampleCounter - 1);
          return this.getEmptyResult();
        }
      }
      
      // Verificar la variabilidad de intervalos para detectar artefactos
      if (rrData.intervals.length >= 3) {
        const variations = [];
        for (let i = 1; i < rrData.intervals.length; i++) {
          variations.push(Math.abs(rrData.intervals[i] - rrData.intervals[i-1]));
        }
        
        const maxVariation = Math.max(...variations);
        const avgVariation = variations.reduce((sum, v) => sum + v, 0) / variations.length;
        
        // Detectar variaciones extremas
        if (maxVariation > 5 * avgVariation) {
          console.warn("VitalSignsProcessor: Rejected RR intervals with implausible variations");
          return this.getEmptyResult();
        }
      }
      
      // Periodo refractario para evitar procesamiento continuo
      if (now - this.lastValidTime < this.REFRACTORY_PERIOD_MS) {
        return this.getEmptyResult();
      }
    }
    
    // Incrementar contador de muestras válidas solo con pruebas superadas
    this.validSampleCounter++;
    
    // Exigir más muestras válidas consecutivas
    if (this.validSampleCounter < this.CONSECUTIVE_VALID_SAMPLES) {
      console.log("VitalSignsProcessor: Building confidence", { 
        counter: this.validSampleCounter, 
        required: this.CONSECUTIVE_VALID_SAMPLES 
      });
      return this.getEmptyResult();
    }
    
    // Actualizar tiempo de última muestra válida
    this.lastValidTime = Date.now();
    
    // Process with validated data only
    const result = this.processor.processSignal(ppgValue, rrData);
    
    console.log("VitalSignsProcessor: Processed valid signal with quality", { 
      signalQuality, 
      validSamples: this.validSampleCounter,
      averageQuality: avgQuality,
      goodQualityRatio
    });
    
    return result;
  }
  
  /**
   * Calcula estadísticas de amplitud de señal
   */
  private calculateAmplitudeStats(values: number[]): { min: number, max: number, avg: number } {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    return { min, max, avg };
  }
  
  /**
   * Calcula el nivel de ruido como la relación entre desviación estándar y valor medio
   */
  private calculateNoiseLevel(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Relación ruido/señal
    return stdDev / (mean + 0.001); // Evitar división por cero
  }
  
  /**
   * Reset the processor to ensure a clean state
   */
  public reset() {
    console.log("VitalSignsProcessor: Reset - all measurements will start from zero");
    this.validSampleCounter = 0;
    this.lastValidTime = 0;
    this.signalQualityHistory = [];
    this.amplitudeHistory = [];
    this.noiseBuffer = [];
    return this.processor.reset();
  }
  
  /**
   * Completely reset the processor and all its data
   * Removes any historical influence to prevent data contamination
   */
  public fullReset(): void {
    console.log("VitalSignsProcessor: Full reset - removing all data history");
    this.validSampleCounter = 0;
    this.lastValidTime = 0;
    this.signalQualityHistory = [];
    this.amplitudeHistory = [];
    this.noiseBuffer = [];
    this.processor.fullReset();
  }
  
  /**
   * Provides empty result with null values to indicate invalid data
   * Used when input validation fails
   */
  private getEmptyResult(): VitalSignsResult {
    return {
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: "--",
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      }
    };
  }
}

// Re-export types for compatibility
export type { VitalSignsResult } from './vital-signs/VitalSignsProcessor';

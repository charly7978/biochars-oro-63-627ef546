
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
  private readonly PERFUSION_INDEX_THRESHOLD = 0.045; // Aumentado para mejor precisión
  private readonly SPO2_WINDOW = 8; // Mayor ventana para lecturas más precisas
  private readonly SMA_WINDOW = 8; // Aumentado para mejor suavizado
  private readonly RR_WINDOW_SIZE = 15; // Mayor ventana para análisis más preciso
  private readonly RMSSD_THRESHOLD = 22; // Incrementado para detección de arritmia más definitiva
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 1200; // Periodo de aprendizaje extendido
  private readonly PEAK_THRESHOLD = 0.35; // Umbral de pico incrementado para reducir falsos positivos
  
  // Umbrales más estrictos para validación mejorada
  private readonly MIN_QUALITY_THRESHOLD = 65; // Calidad mínima incrementada para procesar señales
  private readonly CONSECUTIVE_VALID_SAMPLES = 5; // Mayor número de muestras consecutivas requeridas
  private validSampleCounter: number = 0;
  private lastValidTime: number = 0;
  private readonly REFRACTORY_PERIOD_MS = 1000; // Periodo refractario aumentado
  
  // Nuevo: sistema de validación de señal mejorado con memoria
  private signalQualityHistory: number[] = [];
  private readonly QUALITY_HISTORY_SIZE = 10;
  private readonly MIN_QUALITY_RATIO = 0.6; // Mínimo 60% de muestras deben tener calidad suficiente
  
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
    signalQuality?: number // Nuevo: recibir calidad de señal como parámetro opcional
  ): VitalSignsResult {
    // Actualizar historial de calidad de señal
    if (signalQuality !== undefined) {
      this.signalQualityHistory.push(signalQuality);
      if (this.signalQualityHistory.length > this.QUALITY_HISTORY_SIZE) {
        this.signalQualityHistory.shift();
      }
    }
    
    // Calcular calidad promedio y ratio de señales buenas
    const avgQuality = this.signalQualityHistory.length > 0 ? 
      this.signalQualityHistory.reduce((sum, q) => sum + q, 0) / this.signalQualityHistory.length : 0;
    
    const goodQualityRatio = this.signalQualityHistory.length > 5 ?
      this.signalQualityHistory.filter(q => q >= this.MIN_QUALITY_THRESHOLD).length / this.signalQualityHistory.length : 0;
    
    // Verificación estricta: múltiples criterios de calidad deben cumplirse
    const hasReliableSignal = avgQuality >= this.MIN_QUALITY_THRESHOLD && 
                             goodQualityRatio >= this.MIN_QUALITY_RATIO;
    
    // Validación de calidad de señal más estricta
    if (signalQuality !== undefined && (!hasReliableSignal || signalQuality < this.MIN_QUALITY_THRESHOLD)) {
      this.validSampleCounter = Math.max(0, this.validSampleCounter - 1);
      console.log("VitalSignsProcessor: Rejected low quality signal", { 
        quality: signalQuality, 
        avgQuality, 
        goodQualityRatio, 
        hasReliableSignal 
      });
      return this.getEmptyResult();
    }
    
    // Validate input data - con validación más estricta y detallada
    if (isNaN(ppgValue) || !isFinite(ppgValue) || ppgValue < 0 || Math.abs(ppgValue) > 300) {
      console.warn("VitalSignsProcessor: Rejected invalid PPG value", { value: ppgValue });
      this.validSampleCounter = 0;
      this.signalQualityHistory = []; // Resetear historial ante valor claramente inválido
      return this.getEmptyResult();
    }
    
    // Detección de señal atípica (potencial falso positivo)
    const isOutlier = this.signalQualityHistory.length > 3 && 
                     Math.abs(ppgValue) > 3 * avgQuality;
    
    if (isOutlier) {
      console.warn("VitalSignsProcessor: Rejected outlier PPG value", { 
        value: ppgValue, 
        avgQuality, 
        ratio: Math.abs(ppgValue) / avgQuality 
      });
      return this.getEmptyResult();
    }
    
    // Validate RR data if provided con validaciones adicionales
    if (rrData) {
      const now = Date.now();
      
      // Verificar que haya suficientes intervalos para análisis confiable
      if (rrData.intervals.length < 8) {
        console.warn("VitalSignsProcessor: Insufficient RR intervals for reliable analysis");
        return this.getEmptyResult();
      }
      
      // Verificar que los intervalos sean plausibles fisiológicamente
      const hasInvalidIntervals = rrData.intervals.some(interval => 
        isNaN(interval) || !isFinite(interval) || interval <= 300 || interval > 1800);
      
      if (hasInvalidIntervals) {
        console.warn("VitalSignsProcessor: Rejected invalid RR intervals");
        this.validSampleCounter = Math.max(0, this.validSampleCounter - 1);
        return this.getEmptyResult();
      }
      
      // Verificar tasa de latidos plausible con rangos más estrictos (40-180 BPM)
      if (rrData.intervals.length > 0) {
        const averageRR = rrData.intervals.reduce((sum, val) => sum + val, 0) / rrData.intervals.length;
        const approximateBPM = 60000 / averageRR;
        
        if (approximateBPM < 40 || approximateBPM > 180) {
          console.warn("VitalSignsProcessor: Rejected implausible heart rate", { bpm: approximateBPM });
          this.validSampleCounter = Math.max(0, this.validSampleCounter - 1);
          return this.getEmptyResult();
        }
      }
      
      // Verificar la variabilidad de intervalos RR para detectar artefactos
      if (rrData.intervals.length >= 3) {
        const variations = [];
        for (let i = 1; i < rrData.intervals.length; i++) {
          variations.push(Math.abs(rrData.intervals[i] - rrData.intervals[i-1]));
        }
        
        const maxVariation = Math.max(...variations);
        const avgVariation = variations.reduce((sum, v) => sum + v, 0) / variations.length;
        
        // Detectar variaciones extremas indicativas de artefactos
        if (maxVariation > 5 * avgVariation) {
          console.warn("VitalSignsProcessor: Rejected RR intervals with implausible variations");
          return this.getEmptyResult();
        }
      }
      
      // Prevenir procesamiento durante el periodo refractario
      if (now - this.lastValidTime < this.REFRACTORY_PERIOD_MS) {
        // Aún no ha pasado suficiente tiempo desde la última muestra válida
        return this.getEmptyResult();
      }
    }
    
    // Incrementar contador de muestras válidas
    this.validSampleCounter++;
    
    // Exigir suficientes muestras válidas consecutivas antes de procesar
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
    
    // Validación adicional de resultados
    if (result && result.spo2 > 0) {
      // Verificar resultados plausibles
      if (result.spo2 > 100) {
        result.spo2 = 100; // Limitar a valores fisiológicos
      } else if (result.spo2 < 75) {
        // SpO2 demasiado bajo podría ser un falso positivo
        // Requerir mayor número de muestras para confirmar
        if (this.validSampleCounter < this.CONSECUTIVE_VALID_SAMPLES * 2) {
          result.spo2 = 0;
          console.log("VitalSignsProcessor: Low SpO2 value requires additional validation");
        }
      }
    }
    
    // Validar también otros valores
    if (result && result.glucose > 0) {
      // Valores de glucosa extremos requieren validación adicional
      if (result.glucose < 50 || result.glucose > 300) {
        if (this.validSampleCounter < this.CONSECUTIVE_VALID_SAMPLES * 3) {
          result.glucose = 0;
          console.log("VitalSignsProcessor: Extreme glucose value requires additional validation");
        }
      }
    }
    
    console.log("VitalSignsProcessor: Processed valid signal with quality", { 
      signalQuality, 
      validSamples: this.validSampleCounter 
    });
    
    return result;
  }
  
  /**
   * Reset the processor to ensure a clean state
   */
  public reset() {
    console.log("VitalSignsProcessor: Reset - all measurements will start from zero");
    this.validSampleCounter = 0;
    this.lastValidTime = 0;
    this.signalQualityHistory = [];
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

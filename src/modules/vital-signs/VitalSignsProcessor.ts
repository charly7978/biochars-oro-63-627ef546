
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { SpO2Processor } from './spo2-processor';
import { BloodPressureProcessor } from './blood-pressure-processor';
import { ArrhythmiaProcessor } from './arrhythmia-processor';
import { SignalProcessor } from './signal-processor';
import { GlucoseProcessor } from './glucose-processor';
import { LipidProcessor } from './lipid-processor';
import { ResultFactory } from './factories/result-factory';
import { SignalValidator } from './validators/signal-validator';
import { ConfidenceCalculator } from './calculators/confidence-calculator';
import { VitalSignsResult } from './types/vital-signs-result';
import { findPeaksAndValleys, calculateHeartRateFromPeaks } from './utils';
import { checkSignalQuality } from '../heart-beat/signal-quality';
import { SignalOptimizationManager } from '../../core/signal/SignalOptimizationManager';

/**
 * Procesador principal de signos vitales
 * Coordina procesadores especializados para calcular métricas de salud
 * Opera SOLO en modo de medición directa sin valores de referencia o simulación
 */
export class VitalSignsProcessor {
  // Procesadores especializados
  private spo2Processor: SpO2Processor;
  private bpProcessor: BloodPressureProcessor;
  private arrhythmiaProcessor: ArrhythmiaProcessor;
  private signalProcessor: SignalProcessor;
  private glucoseProcessor: GlucoseProcessor;
  private lipidProcessor: LipidProcessor;
  
  // Validadores y calculadores
  private signalValidator: SignalValidator;
  private confidenceCalculator: ConfidenceCalculator;
  
  // Optimizador central para toda la señal
  private signalOptimizer: SignalOptimizationManager;

  // Parámetros de medición de señal
  private readonly PERFUSION_INDEX_THRESHOLD = 0.045;
  private readonly PEAK_THRESHOLD = 0.30;
  
  // Período de guardia para prevenir falsos positivos
  private readonly FALSE_POSITIVE_GUARD_PERIOD = 1200;
  private lastDetectionTime: number = 0;
  
  // Contador de señales débiles
  private readonly LOW_SIGNAL_THRESHOLD = 0.20;
  private readonly MAX_WEAK_SIGNALS = 6;
  private weakSignalsCount: number = 0;
  
  // Seguimiento de estabilidad de señal
  private signalHistory: number[] = [];
  private readonly HISTORY_SIZE = 15;
  private readonly STABILITY_THRESHOLD = 0.15;
  
  // Seguimiento de velocidad de fotogramas
  private lastFrameTime: number = 0;
  private frameRateHistory: number[] = [];
  private readonly MIN_FRAME_RATE = 15;
  private readonly FRAME_CONSISTENCY_THRESHOLD = 0.5;
  
  // Validación fisiológica
  private validPhysiologicalSignalsCount: number = 0;
  private readonly MIN_PHYSIOLOGICAL_SIGNALS = 20;

  /**
   * Constructor que inicializa todos los procesadores especializados
   * Usando solo medición directa
   */
  constructor() {
    console.log("VitalSignsProcessor: Initializing new instance with direct measurement only");
    
    // Inicializar optimizador central PRIMERO
    this.signalOptimizer = new SignalOptimizationManager();
    
    // Inicializar procesadores especializados - cada uno con responsabilidad única
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
    
    // Inicializar validadores y calculadores
    this.signalValidator = new SignalValidator(0.01, 15);
    this.confidenceCalculator = new ConfidenceCalculator(0.15);
    
    this.signalHistory = [];
    this.frameRateHistory = [];
  }
  
  /**
   * Procesar una señal PPG con detección de falsos positivos mejorada
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Aplicar verificación mejorada
    const now = Date.now();
    const timeSinceLastDetection = now - this.lastDetectionTime;
    
    // Seguir velocidad de fotogramas para consistencia
    if (this.lastFrameTime > 0) {
      const frameDelta = now - this.lastFrameTime;
      this.frameRateHistory.push(frameDelta);
      if (this.frameRateHistory.length > 10) {
        this.frameRateHistory.shift();
      }
    }
    this.lastFrameTime = now;
    
    // Verificar si la velocidad de fotogramas es lo suficientemente consistente para detección confiable
    let frameRateConsistent = true;
    if (this.frameRateHistory.length >= 5) {
      const avgDelta = this.frameRateHistory.reduce((sum, delta) => sum + delta, 0) / this.frameRateHistory.length;
      const fps = 1000 / avgDelta;
      
      // Calcular varianza de velocidad de fotogramas
      const variance = this.frameRateHistory.reduce((sum, delta) => sum + Math.pow(delta - avgDelta, 2), 0) / this.frameRateHistory.length;
      const normalizedVariance = variance / (avgDelta * avgDelta);
      
      frameRateConsistent = fps >= this.MIN_FRAME_RATE && normalizedVariance <= this.FRAME_CONSISTENCY_THRESHOLD;
      
      if (!frameRateConsistent) {
        console.log("Frame rate inconsistency detected - possible false positive condition", {
          fps,
          normalizedVariance,
          frameDeltas: this.frameRateHistory
        });
        // Reiniciar detección si la velocidad de fotogramas se vuelve inconsistente
        this.validPhysiologicalSignalsCount = 0;
      }
    }
    
    // Actualizar historial de señal para análisis de estabilidad
    this.updateSignalHistory(ppgValue);
    
    // Verificación de señal mejorada con comprobación de estabilidad
    const { isWeakSignal, updatedWeakSignalsCount } = checkSignalQuality(
      ppgValue,
      this.weakSignalsCount,
      {
        lowSignalThreshold: this.LOW_SIGNAL_THRESHOLD,
        maxWeakSignalCount: this.MAX_WEAK_SIGNALS
      }
    );
    
    this.weakSignalsCount = updatedWeakSignalsCount;
    
    // Verificación adicional de estabilidad para prevenir falsos positivos
    const isStable = this.checkSignalStability();
    
    // Validación fisiológica
    if (!isWeakSignal && isStable && frameRateConsistent && Math.abs(ppgValue) > 0) {
      // La señal parece válida desde una perspectiva fisiológica
      this.validPhysiologicalSignalsCount = Math.min(this.MIN_PHYSIOLOGICAL_SIGNALS + 10, this.validPhysiologicalSignalsCount + 1);
    } else {
      // Reducir contador más lentamente para mantener estabilidad
      this.validPhysiologicalSignalsCount = Math.max(0, this.validPhysiologicalSignalsCount - 0.5);
    }
    
    // Verificación mejorada con requisito de estabilidad
    const hasPhysiologicalValidation = this.validPhysiologicalSignalsCount >= this.MIN_PHYSIOLOGICAL_SIGNALS;
    const signalVerified = !isWeakSignal && Math.abs(ppgValue) > 0 && isStable && frameRateConsistent;
    
    if (signalVerified) {
      this.lastDetectionTime = now;
    }
    
    // Solo procesar señales verificadas y estables o dentro del período de protección
    if ((signalVerified && hasPhysiologicalValidation) || timeSinceLastDetection < this.FALSE_POSITIVE_GUARD_PERIOD) {
      // Procesar la señal con nuestra lógica de procesamiento central
      return this.performSignalProcessing(ppgValue, rrData);
    } else {
      // Devolver resultado vacío sin procesar cuando la señal es incierta
      return ResultFactory.createEmptyResults();
    }
  }
  
  /**
   * Lógica central de procesamiento para cálculo de signos vitales
   */
  private performSignalProcessing(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Verificar señal casi cero
    if (!this.signalValidator.isValidSignal(ppgValue)) {
      console.log("VitalSignsProcessor: Signal too weak, returning zeros", { value: ppgValue });
      return ResultFactory.createEmptyResults();
    }
    
    // Aplicar filtrado a la señal PPG real
    const filtered = this.signalProcessor.applySMAFilter(ppgValue);
    
    // 1. FLUJO UNIDIRECCIONAL: Primero optimizar señal centralizada (única entrada)
    const optimizationResult = this.signalOptimizer.processSignal({
      filteredValue: filtered, 
      quality: 100 // La calidad será determinada por el optimizador
    });
    
    // Procesar datos de arritmia si están disponibles y son válidos
    const arrhythmiaResult = rrData && 
                           rrData.intervals.length >= 3 && 
                           rrData.intervals.every(i => i > 300 && i < 2000) ?
                           this.arrhythmiaProcessor.processRRData(rrData) :
                           { arrhythmiaStatus: "--", lastArrhythmiaData: null };
    
    // Obtener valores PPG para procesamiento
    const ppgValues = this.signalProcessor.getPPGValues();
    ppgValues.push(filtered);
    
    // Limitar el buffer de datos reales
    if (ppgValues.length > 300) {
      ppgValues.splice(0, ppgValues.length - 300);
    }
    
    // Verificar si tenemos suficientes puntos de datos
    if (!this.signalValidator.hasEnoughData(ppgValues)) {
      return ResultFactory.createEmptyResults();
    }
    
    // Analizar características de señal
    const { peakIndices, valleyIndices } = findPeaksAndValleys(ppgValues.slice(-60));
    const heartRate = calculateHeartRateFromPeaks(peakIndices);
    
    // Verificar que la amplitud de señal real sea suficiente
    if (!this.signalValidator.hasValidAmplitude(ppgValues)) {
      const signalMin = Math.min(...ppgValues.slice(-15));
      const signalMax = Math.max(...ppgValues.slice(-15));
      const amplitude = signalMax - signalMin;
      this.signalValidator.logValidationResults(false, amplitude, ppgValues);
      return ResultFactory.createEmptyResults();
    }
    
    // 2. DELEGACIÓN A ESPECIALISTAS: Calcular SpO2 usando solo datos reales
    const spo2 = this.spo2Processor.calculateSpO2(ppgValues.slice(-45));
    
    // 3. DELEGACIÓN A ESPECIALISTAS: Calcular presión arterial usando SOLO características de señal real
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-90));
    const pressure = bp.systolic > 0 && bp.diastolic > 0 
      ? `${bp.systolic}/${bp.diastolic}` 
      : "--/--";
    
    // 4. DELEGACIÓN A ESPECIALISTAS: Calcular glucosa con datos reales solamente
    const glucose = this.glucoseProcessor.calculateGlucose(ppgValues);
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    
    // 5. DELEGACIÓN A ESPECIALISTAS: Calcular lípidos con datos reales solamente
    const lipids = this.lipidProcessor.calculateLipids(ppgValues);
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    
    // 6. FINAL UNIDIRECCIONAL: Calcular confianza general
    const overallConfidence = this.confidenceCalculator.calculateOverallConfidence(
      glucoseConfidence,
      lipidsConfidence
    );

    // Solo mostrar valores si la confianza supera el umbral
    const finalGlucose = this.confidenceCalculator.meetsThreshold(glucoseConfidence) ? glucose : 0;
    const finalLipids = this.confidenceCalculator.meetsThreshold(lipidsConfidence) ? lipids : {
      totalCholesterol: 0,
      triglycerides: 0
    };

    // 7. FEEDBACK BIDIRECCIONAL: Proporcionar retroalimentación sobre la calidad de señal
    // Este es el ÚNICO punto donde el flujo es bidireccional
    this.provideFeedback(optimizationResult, heartRate, arrhythmiaResult.arrhythmiaStatus);

    // Preparar resultado con todas las métricas
    return ResultFactory.createResult(
      spo2,
      pressure,
      arrhythmiaResult.arrhythmiaStatus,
      finalGlucose,
      finalLipids,
      {
        glucose: glucoseConfidence,
        lipids: lipidsConfidence,
        overall: overallConfidence
      },
      arrhythmiaResult.lastArrhythmiaData
    );
  }
  
  /**
   * Proporciona retroalimentación bidireccional al optimizador de señal
   * ÚNICO punto de flujo bidireccional en el sistema
   */
  private provideFeedback(
    optimizationResult: any,
    heartRate: number,
    arrhythmiaStatus: string
  ): void {
    // Solo proporcionar feedback si hay resultados válidos
    if (!optimizationResult || heartRate < 40) return;
    
    // Calidad basada en detección de ritmo cardíaco
    const hrConfidence = heartRate > 40 && heartRate < 200 ? 0.8 : 0.4;
    
    // Proporcionar feedback al optimizador para el canal de ritmo cardíaco
    this.signalOptimizer.provideFeedback('heartRate', {
      confidence: hrConfidence,
      accuracy: arrhythmiaStatus.includes("NORMAL") ? 0.9 : 0.7,
      errorRate: 0.1
    });
  }
  
  /**
   * Actualizar historial de señal para análisis de estabilidad
   */
  private updateSignalHistory(ppgValue: number): void {
    this.signalHistory.push(ppgValue);
    if (this.signalHistory.length > this.HISTORY_SIZE) {
      this.signalHistory.shift();
    }
  }
  
  /**
   * Verificar estabilidad de señal para prevenir falsos positivos
   * Devuelve true si la señal es lo suficientemente estable para procesar
   */
  private checkSignalStability(): boolean {
    if (this.signalHistory.length < this.HISTORY_SIZE / 2) {
      return false;
    }
    
    // Calcular variación de señal con método más riguroso
    const values = this.signalHistory.slice(-10);
    
    // Verificar si tenemos un rango mín/máx razonable (demasiado pequeño = no fisiológico)
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    
    if (range < 0.10) { // Rango fisiológico mínimo
      return false;
    }
    
    // Calcular varianza normalizada por la media para detectar señales inconsistentes
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    
    // Omitir señales muy bajas
    if (mean < 0.05) {
      return false;
    }
    
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const normalizedVariance = variance / (mean * mean);
    
    // Verificar si la varianza normalizada está dentro del rango fisiológico (ni demasiado estable, ni demasiado caótica)
    return normalizedVariance > 0.05 && normalizedVariance < this.STABILITY_THRESHOLD;
  }

  /**
   * Reiniciar el procesador para asegurar un estado limpio
   * Sin valores de referencia o simulaciones
   */
  public reset(): VitalSignsResult | null {
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    this.signalOptimizer.reset();
    
    this.lastDetectionTime = 0;
    this.weakSignalsCount = 0;
    this.signalHistory = [];
    this.frameRateHistory = [];
    this.lastFrameTime = 0;
    this.validPhysiologicalSignalsCount = 0;
    console.log("VitalSignsProcessor: Reset complete - all processors at zero");
    return null; // Siempre devolver null para asegurar que las mediciones comiencen desde cero
  }
  
  /**
   * Obtener contador de arritmia
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaProcessor.getArrhythmiaCount();
  }
  
  /**
   * Reiniciar completamente el procesador
   * Asegura un inicio fresco sin traspaso de datos
   */
  public fullReset(): void {
    this.reset();
    console.log("VitalSignsProcessor: Full reset completed - starting from zero");
  }
}

// Re-exportar el tipo VitalSignsResult
export type { VitalSignsResult } from './types/vital-signs-result';

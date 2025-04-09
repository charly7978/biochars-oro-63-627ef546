
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

/**
 * Procesador principal de signos vitales
 * - Optimizado para procesamiento de señales REALES exclusivamente
 * - Integra procesadores especializados con mayor sensibilidad a señales débiles
 * - Implementa detección y validación avanzada sin simulaciones
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
  
  // Datos de calidad de señal
  private signalQualityBuffer: number[] = [];
  private startTime: number = Date.now();
  private processedCount: number = 0;
  
  // Umbral mínimo de mediciones REDUCIDO para mayor sensibilidad
  private readonly MIN_MEASUREMENTS_REQUIRED = 20;

  // Diagnóstico y estadísticas
  private diagnostics = {
    startTime: Date.now(),
    totalProcessed: 0,
    validFingerDetections: 0,
    invalidSignalCount: 0,
    maxSignalAmplitude: 0,
    avgSignalQuality: 0,
    stableReadingsCount: 0,
    failureReasons: {} as Record<string, number>
  };

  /**
   * Constructor que inicializa procesadores especializados
   * Solo medición directa con umbrales optimizados
   */
  constructor() {
    console.log("VitalSignsProcessor: Inicializando instancia para medición directa con sensibilidad mejorada");
    
    // Inicializar procesadores especializados
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
    
    // Inicializar validadores con umbrales REDUCIDOS para mayor sensibilidad
    this.signalValidator = new SignalValidator(0.001, 6); // Ultra sensible
    this.confidenceCalculator = new ConfidenceCalculator(0.05); // Umbral mínimo de confianza
  }
  
  /**
   * Procesa señal PPG real y calcula todos los signos vitales
   * Exclusivamente mediciones directas sin valores de referencia ni simulación
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    this.processedCount++;
    this.diagnostics.totalProcessed++;
    
    // Verificar valor cerca de cero o inválido
    if (!this.isValidValue(ppgValue)) {
      this.incrementFailureReason('invalid_value');
      
      if (this.processedCount % 30 === 0) {
        console.log("VitalSignsProcessor: Valor de señal inválido", { 
          value: ppgValue,
          processedCount: this.processedCount 
        });
      }
      return ResultFactory.createEmptyResults();
    }
    
    // Aplicar filtrado a la señal PPG real con sensibilidad mejorada
    const filterResult = this.signalProcessor.applyFilters(ppgValue);
    
    // Actualizar buffer de calidad de señal
    this.updateSignalQualityBuffer(filterResult.quality);
    
    // Actualizar estadísticas de diagnóstico
    this.diagnostics.maxSignalAmplitude = Math.max(
      this.diagnostics.maxSignalAmplitude,
      Math.abs(filterResult.filteredValue - ppgValue)
    );
    this.diagnostics.avgSignalQuality = this.calculateAverageQuality();
    
    // Verificar detección de dedo con umbrales más sensibles
    if (!filterResult.fingerDetected) {
      this.incrementFailureReason('finger_not_detected');
      
      if (this.processedCount % 20 === 0) {
        console.log("VitalSignsProcessor: Dedo no detectado", {
          fingerDetected: filterResult.fingerDetected,
          quality: filterResult.quality,
          processedCount: this.processedCount,
          rawValue: ppgValue,
          filteredValue: filterResult.filteredValue
        });
      }
      return ResultFactory.createEmptyResults();
    } else {
      this.diagnostics.validFingerDetections++;
    }
    
    // Procesar datos de arritmia si están disponibles
    const arrhythmiaResult = rrData && 
                           rrData.intervals &&
                           rrData.intervals.length >= 2 && // Reducido para mayor sensibilidad
                           rrData.intervals.every(i => i > 300 && i < 2000) ?
                           this.arrhythmiaProcessor.processRRData(rrData) :
                           { arrhythmiaStatus: "--", lastArrhythmiaData: null };
    
    // Obtener valores PPG para procesamiento
    const ppgValues = this.signalProcessor.getPPGValues();
    
    // Verificar si tenemos suficientes datos y calidad con umbral adaptativo
    const avgQuality = this.calculateAverageQuality();
    const signalQualityThreshold = this.getAdaptiveQualityThreshold();
    
    if (ppgValues.length < this.MIN_MEASUREMENTS_REQUIRED) {
      this.incrementFailureReason('insufficient_data_points');
      
      if (this.processedCount % 15 === 0) {
        console.log("VitalSignsProcessor: Datos insuficientes", {
          dataPoints: ppgValues.length,
          required: this.MIN_MEASUREMENTS_REQUIRED,
          processedCount: this.processedCount
        });
      }
      
      return ResultFactory.createEmptyResultsWithArrhythmia(
        arrhythmiaResult.arrhythmiaStatus,
        arrhythmiaResult.lastArrhythmiaData
      );
    }
    
    if (avgQuality < signalQualityThreshold) {
      this.incrementFailureReason('low_signal_quality');
      
      if (this.processedCount % 15 === 0) {
        console.log("VitalSignsProcessor: Calidad de señal insuficiente", {
          avgQuality,
          threshold: signalQualityThreshold,
          processedCount: this.processedCount
        });
      }
      
      return ResultFactory.createEmptyResultsWithArrhythmia(
        arrhythmiaResult.arrhythmiaStatus,
        arrhythmiaResult.lastArrhythmiaData
      );
    }
    
    // Calcular SpO2 usando datos reales con ventana reducida para mayor sensibilidad
    const spo2 = this.spo2Processor.calculateSpO2(ppgValues.slice(-30)); // Reducido de 45 a 30
    
    // Calcular presión arterial usando características de señal real con ventana reducida
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-60), avgQuality); // Reducido de 90 a 60
    const pressure = bp.systolic > 0 && bp.diastolic > 0 
      ? `${bp.systolic}/${bp.diastolic}` 
      : "--/--";
    
    // Calcular glucosa con datos reales directos
    const glucose = this.glucoseProcessor.calculateGlucose(ppgValues);
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    
    // Calcular lípidos con datos reales directos
    const lipids = this.lipidProcessor.calculateLipids(ppgValues);
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    
    // Calcular confianza global con umbrales adaptados
    const overallConfidence = this.confidenceCalculator.calculateOverallConfidence(
      glucoseConfidence,
      lipidsConfidence
    );

    // Mostrar valores solo si confianza supera umbral adaptativo
    const confidenceThreshold = Math.max(0.05, this.confidenceCalculator.getConfidenceThreshold() * 
                            (0.5 + (0.5 * Math.min(1, this.processedCount / 100))));
    
    const finalGlucose = this.confidenceCalculator.meetsThreshold(glucoseConfidence, confidenceThreshold) ? 
                        glucose : 0;
                        
    const finalLipids = this.confidenceCalculator.meetsThreshold(lipidsConfidence, confidenceThreshold) ? 
                       lipids : { totalCholesterol: 0, triglycerides: 0 };

    // Incrementar contador de lecturas estables
    if (bp.systolic > 0 && spo2 > 0) {
      this.diagnostics.stableReadingsCount++;
    }

    // Log periódico de diagnóstico
    if (this.processedCount % 15 === 0) {
      console.log("VitalSignsProcessor: Resultados procesados", {
        spo2,
        pressure,
        arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
        glucose: finalGlucose,
        spo2Stats: this.spo2Processor.getSignalStats(),
        signalQuality: avgQuality,
        bufferSize: ppgValues.length,
        processedCount: this.processedCount,
        fingerDetected: filterResult.fingerDetected,
        runningTime: (Date.now() - this.startTime) / 1000,
        stableReadings: this.diagnostics.stableReadingsCount,
        adaptiveThreshold: confidenceThreshold
      });
    }

    // Crear resultado con todos los parámetros
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
   * Verificar si el valor es válido con criterios menos estrictos
   */
  private isValidValue(value: number): boolean {
    return !isNaN(value) && isFinite(value) && Math.abs(value) < 5000;
  }
  
  /**
   * Actualizar buffer de calidad de señal
   */
  private updateSignalQualityBuffer(quality: number): void {
    this.signalQualityBuffer.push(quality);
    if (this.signalQualityBuffer.length > 10) {
      this.signalQualityBuffer.shift();
    }
  }
  
  /**
   * Calcular calidad promedio de señal
   */
  private calculateAverageQuality(): number {
    if (this.signalQualityBuffer.length === 0) {
      return 0;
    }
    
    const sum = this.signalQualityBuffer.reduce((a, b) => a + b, 0);
    return sum / this.signalQualityBuffer.length;
  }
  
  /**
   * Obtener umbral adaptativo de calidad basado en tiempo de ejecución
   * Umbral REDUCIDO para mayor sensibilidad
   */
  private getAdaptiveQualityThreshold(): number {
    const runningTimeMs = Date.now() - this.startTime;
    
    // Ser más permisivo en los primeros 15 segundos
    if (runningTimeMs < 5000) {
      return 5; // Ultra permisivo al inicio
    }
    
    if (runningTimeMs < 10000) {
      return 10;
    }
    
    if (runningTimeMs < 15000) {
      return 15;
    }
    
    // Umbral estándar reducido
    return 20; // Reducido de 25
  }
  
  /**
   * Incrementar contador de razones de fallo para diagnóstico
   */
  private incrementFailureReason(reason: string): void {
    this.diagnostics.failureReasons[reason] = (this.diagnostics.failureReasons[reason] || 0) + 1;
    this.diagnostics.invalidSignalCount++;
  }

  /**
   * Reinicia el procesador para garantizar estado limpio
   * Sin valores de referencia ni simulaciones
   */
  public reset(): VitalSignsResult | null {
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    this.signalQualityBuffer = [];
    
    // Reiniciar diagnósticos
    this.diagnostics = {
      startTime: Date.now(),
      totalProcessed: 0,
      validFingerDetections: 0,
      invalidSignalCount: 0,
      maxSignalAmplitude: 0,
      avgSignalQuality: 0,
      stableReadingsCount: 0,
      failureReasons: {}
    };
    
    console.log("VitalSignsProcessor: Reset completo - todos los procesadores reiniciados");
    return null; // Siempre devolver null para garantizar mediciones desde cero
  }
  
  /**
   * Obtener contador de arritmias
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaProcessor.getArrhythmiaCount();
  }
  
  /**
   * Obtener últimos resultados válidos (siempre devuelve null)
   * Fuerza mediciones nuevas sin valores de referencia
   */
  public getLastValidResults(): VitalSignsResult | null {
    return null; // Siempre null para garantizar mediciones desde cero
  }
  
  /**
   * Reinicio completo del procesador
   * Garantiza inicio fresco sin carryover de datos
   */
  public fullReset(): void {
    this.reset();
    this.processedCount = 0;
    this.startTime = Date.now();
    console.log("VitalSignsProcessor: Reset completo - iniciando desde cero para medición directa");
  }
  
  /**
   * Obtener estadísticas de diagnóstico
   */
  public getDiagnostics(): any {
    return {
      ...this.diagnostics,
      runningTime: (Date.now() - this.startTime) / 1000,
      processedCount: this.processedCount,
      signalQualityBufferSize: this.signalQualityBuffer.length,
      currentQualityThreshold: this.getAdaptiveQualityThreshold(),
      signalProcessorDiagnostics: this.signalProcessor.getDiagnostics(),
      validationRate: this.diagnostics.totalProcessed > 0 ? 
                    (this.diagnostics.validFingerDetections / this.diagnostics.totalProcessed) * 100 : 0
    };
  }
}

// Re-export the VitalSignsResult type
export type { VitalSignsResult } from './types/vital-signs-result';

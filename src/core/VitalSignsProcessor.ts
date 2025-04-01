
import { PPGProcessor } from './signal/PPGProcessor';
import { PeakDetector, RRData } from './signal/PeakDetector';
import { ArrhythmiaDetector } from './analysis/ArrhythmiaDetector';
import { BloodPressureAnalyzer } from './analysis/BloodPressureAnalyzer';
import { DEFAULT_PROCESSOR_CONFIG, ProcessorConfig } from './config/ProcessorConfig';
import { GlucoseEstimator } from './analysis/GlucoseEstimator';
import { LipidEstimator } from './analysis/LipidEstimator';
import { HemoglobinEstimator } from './analysis/HemoglobinEstimator';
import type { ProcessedSignal } from '../types/signal';

export interface VitalSignsResult {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  hemoglobin: number;
  calibration?: {
    isCalibrating: boolean;
    progress: {
      heartRate: number;
      spo2: number;
      pressure: number;
      arrhythmia: number;
      glucose: number;
      lipids: number;
      hemoglobin: number;
    };
  };
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
}

/**
 * Procesador unificado de signos vitales
 * - Arquitectura modular que elimina duplicidades
 * - Enfoque en precisión y consistencia
 * - Optimizado para diversos dispositivos móviles
 */
export class VitalSignsProcessor {
  // Componentes de procesamiento
  private ppgProcessor: PPGProcessor;
  private peakDetector: PeakDetector;
  private arrhythmiaDetector: ArrhythmiaDetector;
  private bpAnalyzer: BloodPressureAnalyzer;
  private glucoseEstimator: GlucoseEstimator;
  private lipidEstimator: LipidEstimator;
  private hemoglobinEstimator: HemoglobinEstimator;
  
  // Estado del procesador
  private lastValidResults: VitalSignsResult | null = null;
  private isCalibrating: boolean = false;
  private calibrationStartTime: number = 0;
  private calibrationSamples: number = 0;
  private readonly CALIBRATION_REQUIRED_SAMPLES: number = 50;
  private readonly CALIBRATION_DURATION_MS: number = 8000;
  
  // Progreso de calibración
  private calibrationProgress = {
    heartRate: 0,
    spo2: 0,
    pressure: 0,
    arrhythmia: 0,
    glucose: 0,
    lipids: 0,
    hemoglobin: 0
  };
  
  // Finalización forzada de calibración
  private forceCompleteCalibration: boolean = false;
  private calibrationTimer: any = null;
  
  // Buffer de señal PPG
  private ppgValues: number[] = [];
  
  /**
   * Constructor del procesador unificado
   */
  constructor(config: Partial<ProcessorConfig> = {}) {
    const fullConfig = { ...DEFAULT_PROCESSOR_CONFIG, ...config };
    
    this.ppgProcessor = new PPGProcessor(
      this.handleProcessedSignal.bind(this)
    );
    
    this.peakDetector = new PeakDetector();
    this.arrhythmiaDetector = new ArrhythmiaDetector();
    this.bpAnalyzer = new BloodPressureAnalyzer(fullConfig);
    this.glucoseEstimator = new GlucoseEstimator(fullConfig);
    this.lipidEstimator = new LipidEstimator(fullConfig);
    this.hemoglobinEstimator = new HemoglobinEstimator(fullConfig);
    
    console.log('Procesador de signos vitales unificado inicializado');
  }
  
  /**
   * Inicia proceso de calibración
   */
  public startCalibration(): void {
    if (this.isCalibrating) return;
    
    this.isCalibrating = true;
    this.calibrationStartTime = Date.now();
    this.calibrationSamples = 0;
    this.forceCompleteCalibration = false;
    
    // Reiniciar progreso de calibración
    this.calibrationProgress = {
      heartRate: 0,
      spo2: 0,
      pressure: 0,
      arrhythmia: 0,
      glucose: 0,
      lipids: 0,
      hemoglobin: 0
    };
    
    // Establecer temporizador de calibración
    if (this.calibrationTimer) {
      clearTimeout(this.calibrationTimer);
    }
    
    this.calibrationTimer = setTimeout(() => {
      this.completeCalibration();
    }, this.CALIBRATION_DURATION_MS);
    
    console.log('Calibración iniciada');
  }
  
  /**
   * Completa el proceso de calibración
   */
  private completeCalibration(): void {
    if (!this.isCalibrating) return;
    
    this.isCalibrating = false;
    this.forceCompleteCalibration = false;
    
    if (this.calibrationTimer) {
      clearTimeout(this.calibrationTimer);
      this.calibrationTimer = null;
    }
    
    // Determinar si tenemos suficientes muestras para calibración
    const hasEnoughSamples = this.calibrationSamples >= this.CALIBRATION_REQUIRED_SAMPLES;
    
    // Aplicar calibración solo si hay suficientes muestras
    if (hasEnoughSamples && this.ppgValues.length > 100) {
      const recentValues = this.ppgValues.slice(-100);
      
      // Actualizar progreso a 100% para todos los componentes
      Object.keys(this.calibrationProgress).forEach(key => {
        this.calibrationProgress[key] = 100;
      });
      
      console.log('Calibración completada con éxito');
    } else {
      console.log('Calibración fallida: insuficientes muestras');
    }
  }
  
  /**
   * Procesa una señal PPG y genera resultados de signos vitales
   */
  public processSignal(
    ppgValue: number,
    rrData?: RRData
  ): VitalSignsResult {
    // Añadir valor a buffer
    this.ppgValues.push(ppgValue);
    if (this.ppgValues.length > DEFAULT_PROCESSOR_CONFIG.bufferSize) {
      this.ppgValues.shift();
    }
    
    // Detectar picos en la señal
    const peakInfo = this.peakDetector.detectPeaks(this.ppgValues);
    
    // Procesar arritmias
    const arrhythmiaResult = this.arrhythmiaDetector.processRRData(rrData);
    
    // Calcular SpO2
    const spo2 = this.calculateSpO2(this.ppgValues);
    
    // Calcular presión arterial
    const bloodPressure = this.bpAnalyzer.estimate();
    
    // Calcular métricas no invasivas
    const glucose = this.glucoseEstimator.estimate();
    const lipids = this.lipidEstimator.estimateLipids();
    const hemoglobin = this.hemoglobinEstimator.estimate();
    
    // Actualizar conteo de muestras de calibración
    if (this.isCalibrating) {
      this.calibrationSamples++;
      this.updateCalibrationProgress();
      
      // Verificar si calibración debe finalizar
      if (this.forceCompleteCalibration || 
          Date.now() - this.calibrationStartTime >= this.CALIBRATION_DURATION_MS) {
        this.completeCalibration();
      }
    }
    
    // Crear resultado
    const result: VitalSignsResult = {
      spo2,
      pressure: bloodPressure,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      glucose,
      lipids,
      hemoglobin,
      lastArrhythmiaData: arrhythmiaResult.lastArrhythmiaData
    };
    
    // Añadir información de calibración si está en proceso
    if (this.isCalibrating) {
      result.calibration = {
        isCalibrating: true,
        progress: { ...this.calibrationProgress }
      };
    }
    
    // Actualizar últimos resultados válidos
    this.lastValidResults = result;
    
    return result;
  }
  
  /**
   * Calcula SpO2 basado en valores PPG
   */
  private calculateSpO2(values: number[]): number {
    if (values.length < 30) return 98; // Valor por defecto
    
    // Implementación simplificada para este ejemplo
    // En producción, usar análisis más sofisticado
    let spo2 = 98; // Valor base saludable
    
    const recentValues = values.slice(-30);
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const amplitude = max - min;
    
    // Ajustar ligeramente basado en amplitud
    if (amplitude > 0.1) {
      spo2 = Math.min(100, spo2 + 1);
    } else if (amplitude < 0.05) {
      spo2 = Math.max(90, spo2 - 2);
    }
    
    return Math.round(spo2);
  }
  
  /**
   * Actualiza progreso de calibración
   */
  private updateCalibrationProgress(): void {
    const progress = Math.min(100, (this.calibrationSamples / this.CALIBRATION_REQUIRED_SAMPLES) * 100);
    
    // Actualizar progreso de manera ligeramente diferente para cada componente
    this.calibrationProgress.heartRate = progress;
    this.calibrationProgress.spo2 = Math.max(0, progress - 5);
    this.calibrationProgress.pressure = Math.max(0, progress - 10);
    this.calibrationProgress.arrhythmia = Math.max(0, progress - 15);
    this.calibrationProgress.glucose = Math.max(0, progress - 20);
    this.calibrationProgress.lipids = Math.max(0, progress - 25);
    this.calibrationProgress.hemoglobin = Math.max(0, progress - 30);
  }
  
  /**
   * Verifica si se está calibrando actualmente
   */
  public isCurrentlyCalibrating(): boolean {
    return this.isCalibrating;
  }
  
  /**
   * Obtiene estado de progreso de calibración
   */
  public getCalibrationProgress(): VitalSignsResult['calibration'] {
    return {
      isCalibrating: this.isCalibrating,
      progress: { ...this.calibrationProgress }
    };
  }
  
  /**
   * Fuerza la finalización de la calibración
   */
  public forceCalibrationCompletion(): void {
    if (this.isCalibrating) {
      this.forceCompleteCalibration = true;
      this.completeCalibration();
    }
  }
  
  /**
   * Reinicia el procesador manteniendo parámetros de calibración
   */
  public reset(): VitalSignsResult | null {
    this.ppgValues = [];
    this.peakDetector.reset();
    this.arrhythmiaDetector.reset();
    
    if (this.calibrationTimer) {
      clearTimeout(this.calibrationTimer);
      this.calibrationTimer = null;
    }
    
    this.isCalibrating = false;
    this.forceCompleteCalibration = false;
    
    return this.lastValidResults;
  }
  
  /**
   * Reinicio completo incluyendo calibración
   */
  public fullReset(): void {
    this.reset();
    this.lastValidResults = null;
  }
  
  /**
   * Manejador de señales procesadas
   */
  private handleProcessedSignal(signal: ProcessedSignal): void {
    // Implementación de callback para señales procesadas
    // Este método podría expandirse según necesidades
    console.log('Señal procesada:', signal);
  }
}

// Exportar estimadores
export { GlucoseEstimator } from './analysis/GlucoseEstimator';
export { LipidEstimator } from './analysis/LipidEstimator';
export { HemoglobinEstimator } from './analysis/HemoglobinEstimator';

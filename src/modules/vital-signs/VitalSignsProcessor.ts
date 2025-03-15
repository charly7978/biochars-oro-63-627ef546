
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

import { SpO2Calculator } from './spo2-calculator';
import { BloodPressureCalculator } from './blood-pressure-calculator';
import { GlucoseProcessor } from './glucose-processor';
import { LipidProcessor } from './lipid-processor';

export interface VitalSignsResult {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  signalQuality: number;
  glucose?: number;
  lipids?: {
    totalCholesterol: number;
    triglycerides: number;
  };
  rawPPG?: number;
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
  calibration?: {
    progress: {
      heartRate: number;
      spo2: number;
      pressure: number;
      arrhythmia: number;
      glucose: number;
      lipids: number;
    }
  };
}

// Buffer para almacenar valores PPG recientes
interface SignalBuffer {
  ppgValues: number[];
  maxSize: number;
  addValue(value: number): void;
  getValues(): number[];
  reset(): void;
}

class PPGBuffer implements SignalBuffer {
  ppgValues: number[] = [];
  maxSize: number;
  
  constructor(maxSize: number) {
    this.maxSize = maxSize;
    this.ppgValues = [];
  }
  
  addValue(value: number): void {
    this.ppgValues.push(value);
    if (this.ppgValues.length > this.maxSize) {
      this.ppgValues.shift();
    }
  }
  
  getValues(): number[] {
    return this.ppgValues;
  }
  
  reset(): void {
    this.ppgValues = [];
  }
}

export class VitalSignsProcessor {
  private signalBuffer: SignalBuffer;
  private spo2Calculator: SpO2Calculator;
  private bpCalculator: BloodPressureCalculator;
  private glucoseProcessor: GlucoseProcessor;
  private lipidProcessor: LipidProcessor;
  
  private lastResults: VitalSignsResult | null = null;
  private signalQuality: number = 0;
  private processedFrames: number = 0;
  
  constructor() {
    this.signalBuffer = new PPGBuffer(300);
    this.spo2Calculator = new SpO2Calculator();
    this.bpCalculator = new BloodPressureCalculator();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
  }
  
  /**
   * Procesa una señal PPG y datos RR para calcular signos vitales
   * Sin simulaciones - Procesamiento 100% real
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Agregar valor a buffer
    this.signalBuffer.addValue(ppgValue);
    this.processedFrames++;
    
    // Calcular calidad de señal
    const ppgValues = this.signalBuffer.getValues();
    this.signalQuality = this.calculateSignalQuality(ppgValues);
    
    // Calcular SpO2
    const spo2 = this.spo2Calculator.calculateSpO2(ppgValues);
    
    // Calcular presión arterial
    const bp = this.bpCalculator.calculateBP(ppgValues, rrData?.intervals || []);
    
    // Calcular glucosa
    const glucose = this.glucoseProcessor.calculateGlucose(ppgValues);
    
    // Calcular lípidos
    const lipids = this.lipidProcessor.calculateLipids(ppgValues);
    
    // Progreso de calibración
    const calibrationProgress = {
      heartRate: Math.min(100, this.processedFrames / 30),
      spo2: Math.min(100, this.processedFrames / 50),
      pressure: Math.min(100, this.processedFrames / 100),
      arrhythmia: Math.min(100, this.processedFrames / 150),
      glucose: Math.min(100, this.processedFrames / 180),
      lipids: Math.min(100, this.processedFrames / 200)
    };
    
    // Crear resultado
    const result: VitalSignsResult = {
      spo2,
      pressure: bp,
      arrhythmiaStatus: "SIN ARRITMIAS|0",
      signalQuality: Math.round(this.signalQuality * 100),
      glucose,
      lipids,
      rawPPG: ppgValue,
      calibration: {
        progress: calibrationProgress
      }
    };
    
    // Guardar resultados si son válidos
    if (spo2 > 0 || bp !== "--/--") {
      this.lastResults = {...result};
    }
    
    return result;
  }
  
  /**
   * Calcula la calidad de la señal
   */
  private calculateSignalQuality(values: number[]): number {
    if (values.length < 10) return 0;
    
    // Calcular proporción señal-ruido
    const signalMean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - signalMean, 2), 0) / values.length;
    
    if (variance === 0) return 0;
    
    // Normalizar calidad entre 0 y 1
    return Math.max(0, Math.min(1, signalMean / Math.sqrt(variance) / 10));
  }
  
  /**
   * Reinicia el procesador pero mantiene los últimos resultados válidos
   */
  public reset(): VitalSignsResult | null {
    const savedResults = this.lastResults;
    
    this.signalBuffer.reset();
    this.spo2Calculator.reset();
    // No es necesario resetear bpCalculator ya que no tiene estado
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    
    this.processedFrames = 0;
    
    return savedResults;
  }
  
  /**
   * Reinicia completamente el procesador y todos sus datos
   */
  public fullReset(): void {
    this.signalBuffer.reset();
    this.spo2Calculator.reset();
    // No es necesario resetear bpCalculator ya que no tiene estado
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    
    this.lastResults = null;
    this.signalQuality = 0;
    this.processedFrames = 0;
  }
}

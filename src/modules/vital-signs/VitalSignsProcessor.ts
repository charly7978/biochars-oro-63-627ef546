
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

import { SpO2Processor } from './spo2-processor';
import { BloodPressureProcessor } from './blood-pressure-processor';
import { ArrhythmiaProcessor } from './arrhythmia-processor';
import { SignalProcessor } from './signal-processor';
import { GlucoseProcessor } from './glucose-processor';
import { LipidProcessor } from './lipid-processor';

export interface VitalSignsResult {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  lastArrhythmiaData?: { 
    timestamp: number; 
    rmssd: number; 
    rrVariation: number; 
  } | null;
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  confidence?: {
    glucose: number;
    lipids: number;
    overall: number;
  };
}

/**
 * Procesador principal de signos vitales
 * Integra los diferentes procesadores especializados para calcular métricas de salud
 * con enfoque en precisión y honestidad de los resultados
 */
export class VitalSignsProcessor {
  private spo2Processor: SpO2Processor;
  private bpProcessor: BloodPressureProcessor;
  private arrhythmiaProcessor: ArrhythmiaProcessor;
  private signalProcessor: SignalProcessor;
  private glucoseProcessor: GlucoseProcessor;
  private lipidProcessor: LipidProcessor;
  
  private lastValidResults: VitalSignsResult | null = null;
  
  // Umbrales de señal mínima para considerar mediciones válidas
  // Reducidos significativamente para máxima sensibilidad
  private readonly MIN_SIGNAL_AMPLITUDE = 0.005; // Reducido al mínimo para máxima sensibilidad
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.15; // Reducido para máxima sensibilidad
  
  // Valores para detección avanzada
  private signalHistory: number[] = [];
  private readonly HISTORY_SIZE = 10;
  private consecutiveSignals = 0;
  private readonly MIN_CONSECUTIVE_SIGNALS = 3;

  constructor() {
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
    
    console.log("VitalSignsProcessor: Inicializado con configuración ultra-sensible para mejor detección");
  }
  
  /**
   * Procesa la señal PPG y calcula todos los signos vitales
   * Usando estrategia de máxima sensibilidad para detección temprana
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Actualizar historial de señal
    this.signalHistory.push(ppgValue);
    if (this.signalHistory.length > this.HISTORY_SIZE) {
      this.signalHistory.shift();
    }
    
    // Detección de señal con umbral adaptativo
    const signalVariation = this.calculateSignalVariation();
    const hasMinimalVariation = signalVariation > 0.002; // Umbral ultra-sensible
    
    // Verificar señal mínima con lógica adaptativa
    if (ppgValue < this.MIN_SIGNAL_AMPLITUDE || !hasMinimalVariation) {
      this.consecutiveSignals = 0;
      return this.getLastValidResults() || this.createEmptyResults();
    } else {
      this.consecutiveSignals = Math.min(this.consecutiveSignals + 1, 10);
    }
    
    // Iniciar procesamiento sólo si hay señal constante
    if (this.consecutiveSignals < this.MIN_CONSECUTIVE_SIGNALS) {
      return this.getLastValidResults() || this.createEmptyResults();
    }

    // Aplicar filtrado a la señal PPG - más suave para preservar señales débiles
    const filtered = this.signalProcessor.applySMAFilter(ppgValue);
    
    // Procesar datos de arritmia si están disponibles
    const arrhythmiaResult = this.arrhythmiaProcessor.processRRData(rrData);
    
    // Obtener los valores PPG para procesamiento
    const ppgValues = this.signalProcessor.getPPGValues();
    
    // Procesar incluso con pocos datos (máxima sensibilidad)
    if (ppgValues.length < 20) {
      return this.getLastValidResults() || this.createEmptyResults();
    }
    
    // Calcular SpO2
    const spo2 = this.spo2Processor.calculateSpO2(ppgValues.slice(-40));
    
    // Calcular presión arterial
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-60));
    const pressure = bp.systolic > 0 && bp.diastolic > 0 
      ? `${bp.systolic}/${bp.diastolic}` 
      : "--/--";
    
    // Calcular glucosa con validación de confianza
    const glucose = this.glucoseProcessor.calculateGlucose(ppgValues);
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    
    // Calcular lípidos con validación de confianza
    const lipids = this.lipidProcessor.calculateLipids(ppgValues);
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    
    // Calcular confianza general basada en promedios ponderados
    const overallConfidence = (glucoseConfidence * 0.5) + (lipidsConfidence * 0.5);

    // Preparar resultado con todas las métricas calculadas
    const result: VitalSignsResult = {
      spo2,
      pressure,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      lastArrhythmiaData: arrhythmiaResult.lastArrhythmiaData,
      glucose,
      lipids,
      confidence: {
        glucose: glucoseConfidence,
        lipids: lipidsConfidence,
        overall: overallConfidence
      }
    };
    
    // Actualizar resultados con umbral de confianza muy bajo para máxima sensibilidad
    if (this.isValidMeasurement(result)) {
      this.lastValidResults = { ...result };
    }

    return result;
  }
  
  // Calcular variación de señal para detección adaptativa
  private calculateSignalVariation(): number {
    if (this.signalHistory.length < 3) return 0;
    
    // Calcular diferencias entre mediciones consecutivas
    const differences: number[] = [];
    for (let i = 1; i < this.signalHistory.length; i++) {
      differences.push(Math.abs(this.signalHistory[i] - this.signalHistory[i-1]));
    }
    
    // Obtener variación media
    return differences.reduce((sum, val) => sum + val, 0) / differences.length;
  }
  
  /**
   * Verifica si una medición tiene suficiente calidad para considerarse válida
   * Criterios con máxima sensibilidad
   */
  private isValidMeasurement(result: VitalSignsResult): boolean {
    const { spo2, pressure, glucose, lipids, confidence } = result;
    const [systolic, diastolic] = pressure.split('/').map(v => parseInt(v));
    
    // Criterios con umbral mínimo para máxima sensibilidad
    return (
      (confidence?.overall === undefined || confidence.overall >= this.MIN_CONFIDENCE_THRESHOLD) &&
      (spo2 >= 0) && 
      (!isNaN(systolic) || !isNaN(diastolic)) && 
      (glucose >= 0) && 
      (lipids.totalCholesterol >= 0)
    );
  }
  
  /**
   * Crea un resultado vacío para cuando no hay datos válidos
   */
  private createEmptyResults(): VitalSignsResult {
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

  /**
   * Reinicia el procesador manteniendo los últimos resultados válidos
   */
  public reset(): VitalSignsResult | null {
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    this.signalHistory = [];
    this.consecutiveSignals = 0;
    
    return this.lastValidResults;
  }
  
  /**
   * Obtiene los últimos resultados válidos
   */
  public getLastValidResults(): VitalSignsResult | null {
    return this.lastValidResults;
  }
  
  /**
   * Reinicia completamente el procesador, eliminando datos y resultados previos
   */
  public fullReset(): void {
    this.reset();
    this.lastValidResults = null;
  }
}

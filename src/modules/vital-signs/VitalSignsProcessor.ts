
import { SpO2Processor } from './spo2-processor';
import { BloodPressureProcessor } from './blood-pressure-processor';
import { ArrhythmiaProcessor } from './arrhythmia-processor';
import { SignalProcessor } from './signal-processor';
import { GlucoseProcessor } from './glucose-processor';
import { LipidProcessor } from './lipid-processor';
import { HemoglobinProcessor } from './hemoglobin-processor';
import { CalibrationManager } from './calibration-manager';

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
  private hemoglobinProcessor: HemoglobinProcessor;
  private calibrationManager: CalibrationManager;
  
  private lastValidResults: VitalSignsResult | null = null;
  
  // Umbrales de señal mínima para considerar mediciones válidas
  private readonly MIN_SIGNAL_AMPLITUDE = 0.05;
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.4;

  constructor() {
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
    this.hemoglobinProcessor = new HemoglobinProcessor();
    this.calibrationManager = new CalibrationManager();
    
    console.log("VitalSignsProcessor: Inicializado con configuración optimizada");
  }

  /**
   * Inicia el proceso de calibración para mejorar la precisión de las mediciones
   */
  public startCalibration(): void {
    this.calibrationManager.startCalibration();
  }
  
  /**
   * Procesa la señal PPG y calcula todos los signos vitales
   * Implementando estrategias mejoradas de validación y estabilidad
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Verificar calidad mínima de señal
    if (ppgValue < this.MIN_SIGNAL_AMPLITUDE) {
      return this.getLastValidResults() || this.createEmptyResults();
    }

    // Aplicar filtrado a la señal PPG
    const filtered = this.signalProcessor.applySMAFilter(ppgValue);
    
    // Procesar datos de arritmia si están disponibles
    const arrhythmiaResult = this.arrhythmiaProcessor.processRRData(rrData);
    
    // Obtener los valores PPG para procesamiento
    const ppgValues = this.signalProcessor.getPPGValues();
    
    // Solo procesar si hay suficientes datos de PPG
    if (ppgValues.length < 100) {
      return this.getLastValidResults() || this.createEmptyResults();
    }
    
    // Calcular SpO2
    const spo2 = this.spo2Processor.calculateSpO2(ppgValues.slice(-60));
    
    // Calcular presión arterial
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-120));
    const pressure = bp.systolic > 0 && bp.diastolic > 0 
      ? `${bp.systolic}/${bp.diastolic}` 
      : "--/--";
    
    // Calcular glucosa con validación de confianza
    const glucose = this.glucoseProcessor.calculateGlucose(ppgValues);
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    
    // Calcular lípidos con validación de confianza
    const lipids = this.lipidProcessor.calculateLipids(ppgValues);
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    
    // Calcular hemoglobina
    const hemoglobin = this.hemoglobinProcessor.calculateHemoglobin(ppgValues);
    
    // Durante calibración, almacenar mediciones para análisis estadístico
    if (this.calibrationManager.isCurrentlyCalibrating()) {
      this.calibrationManager.addCalibrationSample(
        spo2, 
        bp.systolic, 
        bp.diastolic, 
        glucose, 
        lipids.totalCholesterol
      );
    }
    
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
      hemoglobin,
      confidence: {
        glucose: glucoseConfidence,
        lipids: lipidsConfidence,
        overall: overallConfidence
      }
    };
    
    // Incluir información de calibración si está en proceso
    const calibrationInfo = this.calibrationManager.getCalibrationProgress();
    if (calibrationInfo) {
      result.calibration = calibrationInfo;
    }
    
    // Solo actualizar resultados válidos si hay suficiente confianza
    if (this.isValidMeasurement(result)) {
      this.lastValidResults = { ...result };
    }

    return result;
  }
  
  /**
   * Verifica si una medición tiene suficiente calidad para considerarse válida
   */
  private isValidMeasurement(result: VitalSignsResult): boolean {
    const { spo2, pressure, glucose, lipids, confidence } = result;
    const [systolic, diastolic] = pressure.split('/').map(v => parseInt(v));
    
    return (
      confidence?.overall && confidence.overall >= this.MIN_CONFIDENCE_THRESHOLD &&
      spo2 > 0 && 
      !isNaN(systolic) && systolic > 0 && 
      !isNaN(diastolic) && diastolic > 0 && 
      glucose > 0 && 
      lipids.totalCholesterol > 0
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
      },
      hemoglobin: 0
    };
  }

  /**
   * Verifica si está en proceso de calibración
   */
  public isCurrentlyCalibrating(): boolean {
    return this.calibrationManager.isCurrentlyCalibrating();
  }

  /**
   * Obtiene el progreso actual de calibración
   */
  public getCalibrationProgress(): VitalSignsResult['calibration'] {
    return this.calibrationManager.getCalibrationProgress();
  }

  /**
   * Fuerza la finalización del proceso de calibración
   */
  public forceCalibrationCompletion(): void {
    this.calibrationManager.forceCalibrationCompletion();
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
    this.hemoglobinProcessor.reset();
    this.calibrationManager.reset();
    
    return this.lastValidResults;
  }
  
  /**
   * Obtiene los últimos resultados válidos
   */
  public getLastValidResults(): VitalSignsResult | null {
    return this.lastValidResults;
  }
  
  /**
   * Reinicia completamente el procesador, eliminando datos de calibración y resultados previos
   */
  public fullReset(): void {
    this.reset();
    this.lastValidResults = null;
  }
}

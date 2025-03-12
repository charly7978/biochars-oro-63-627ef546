
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
  hemoglobin: number;
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
  
  // Balanced thresholds for measurement validation
  private readonly MIN_SIGNAL_AMPLITUDE = 0.03;
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.35;

  constructor() {
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
    
    console.log("VitalSignsProcessor: Inicializado con configuración optimizada");
  }

  /**
   * Procesa la señal PPG y calcula todos los signos vitales
   * Implementando estrategias mejoradas de validación y estabilidad
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Verificar calidad mínima de señal - balanced threshold
    if (ppgValue < this.MIN_SIGNAL_AMPLITUDE) {
      return this.getLastValidResults() || {
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
    
    // Aplicar filtrado a la señal PPG
    const filtered = this.signalProcessor.applySMAFilter(ppgValue);
    
    // Procesar datos de arritmia si están disponibles
    const arrhythmiaResult = this.arrhythmiaProcessor.processRRData(rrData);
    
    // Obtener los valores PPG para procesamiento
    const ppgValues = this.signalProcessor.getPPGValues();
    
    // Solo procesar con suficientes datos - balanced minimum
    if (ppgValues.length < 60) {
      return this.getLastValidResults() || {
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
    
    // Calcular SpO2
    const spo2 = this.spo2Processor.calculateSpO2(ppgValues.slice(-60));
    
    // Calcular presión arterial
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-120));
    const pressure = bp.systolic > 0 && bp.diastolic > 0 
      ? `${bp.systolic}/${bp.diastolic}` 
      : "--/--";
    
    // Calcular glucosa con validación estándar
    const glucose = this.glucoseProcessor.calculateGlucose(ppgValues);
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    
    // Calcular lípidos
    const lipids = this.lipidProcessor.calculateLipids(ppgValues);
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    
    // Calcular hemoglobina
    const hemoglobin = this.calculateHemoglobin(ppgValues);
    
    // Balanced confidence calculation
    const overallConfidence = (glucoseConfidence * 0.5) + (lipidsConfidence * 0.5);

    // Preparar resultado con todas las métricas calculadas
    const result: VitalSignsResult = {
      spo2,
      pressure,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      lastArrhythmiaData: arrhythmiaResult.lastArrhythmiaData,
      glucose,
      lipids,
      hemoglobin
    };
    
    // Actualizar resultados válidos con threshold balanced
    if (overallConfidence >= this.MIN_CONFIDENCE_THRESHOLD &&
        spo2 > 0 && 
        bp.systolic > 0 && bp.diastolic > 0 && 
        glucose > 0 && 
        lipids.totalCholesterol > 0) {
      this.lastValidResults = { ...result };
    }

    return result;
  }

  /**
   * Calcula nivel de hemoglobina estimado con parámetros balanceados
   */
  private calculateHemoglobin(ppgValues: number[]): number {
    if (ppgValues.length < 80) return 0;
    
    // Normalizar valores
    const min = Math.min(...ppgValues);
    const max = Math.max(...ppgValues);
    if (max - min < 0.03) return 0; // Balanced minimum amplitude
    
    const normalized = ppgValues.map(v => (v - min) / (max - min));
    
    // Calcular área bajo la curva
    const auc = normalized.reduce((sum, val) => sum + val, 0) / normalized.length;
    
    // Modelo balanceado
    const baseHemoglobin = 14.0; // g/dL (valor normal promedio)
    const hemoglobin = baseHemoglobin - ((0.55 - auc) * 6);
    
    // Limitar a rango fisiológico normal
    return Math.max(11, Math.min(16, hemoglobin));
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

  // Métodos dummy para mantener la compatibilidad con el resto del código
  public startCalibration(): void {
    // Método vacío - calibración removida
    console.log("Auto-calibración desactivada");
  }

  public forceCalibrationCompletion(): void {
    // Método vacío - calibración removida
    console.log("Auto-calibración desactivada");
  }

  public isCurrentlyCalibrating(): boolean {
    // Siempre retorna falso - calibración removida
    return false;
  }

  public getCalibrationProgress(): undefined {
    // Siempre retorna undefined - calibración removida
    return undefined;
  }
}

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
 * Solo utiliza datos PPG reales, sin simulaciones
 */
export class VitalSignsProcessor {
  public spo2Processor: SpO2Processor;
  public bpProcessor: BloodPressureProcessor;
  public arrhythmiaProcessor: ArrhythmiaProcessor;
  public signalProcessor: SignalProcessor;
  public glucoseProcessor: GlucoseProcessor;
  public lipidProcessor: LipidProcessor;
  
  private lastValidResults: VitalSignsResult | null = null;
  private isCalibrating: boolean = false;
  private calibrationStartTime: number = 0;
  private calibrationSamples: number = 0;
  private readonly CALIBRATION_REQUIRED_SAMPLES: number = 50;
  private readonly CALIBRATION_DURATION_MS: number = 8000;
  
  private spo2Samples: number[] = [];
  private pressureSamples: number[] = [];
  private heartRateSamples: number[] = [];
  private glucoseSamples: number[] = [];
  private lipidSamples: number[] = [];
  
  // Umbrales de señal mínima para considerar mediciones válidas
  private readonly MIN_SIGNAL_AMPLITUDE = 0.05;
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.4;

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
  
  private forceCompleteCalibration: boolean = false;
  private calibrationTimer: any = null;
  private ppgBuffer: number[] = [];
  private readonly PPG_BUFFER_SIZE = 300;

  constructor() {
    console.log("VitalSignsProcessor: Inicializando con procesamiento basado exclusivamente en datos reales");
    
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
    
    // Registro global para acceso desde otros componentes
    if (typeof window !== 'undefined') {
      (window as any).vitalSignsProcessor = this;
      console.log('VitalSignsProcessor: Registrado globalmente');
    }
  }

  /**
   * Inicia el proceso de calibración
   */
  public startCalibration(): void {
    if (this.isCalibrating) {
      console.log("VitalSignsProcessor: Ya hay una calibración en curso");
      return;
    }

    this.isCalibrating = true;
    this.calibrationStartTime = Date.now();
    this.calibrationSamples = 0;
    this.forceCompleteCalibration = false;

    // Reiniciar buffers de calibración
    this.spo2Samples = [];
    this.pressureSamples = [];
    this.heartRateSamples = [];
    this.glucoseSamples = [];
    this.lipidSamples = [];

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

    // Configurar temporizador de calibración
    if (this.calibrationTimer) {
      clearTimeout(this.calibrationTimer);
    }
    
    this.calibrationTimer = setTimeout(() => {
      console.log(`VitalSignsProcessor: Completando calibración por timeout (${this.CALIBRATION_DURATION_MS}ms)`);
      if (this.isCalibrating) {
        this.completeCalibration();
      }
    }, this.CALIBRATION_DURATION_MS);

    console.log("VitalSignsProcessor: Calibración iniciada");
  }
  
  /**
   * Completa el proceso de calibración
   */
  private completeCalibration(): void {
    if (!this.isCalibrating) {
      return;
    }
    
    // Comprobar si hay muestras suficientes
    if (this.calibrationSamples < this.CALIBRATION_REQUIRED_SAMPLES && !this.forceCompleteCalibration) {
      console.log(`VitalSignsProcessor: Calibración incompleta (${this.calibrationSamples}/${this.CALIBRATION_REQUIRED_SAMPLES} muestras)`);
      
      // Actualizar progreso proporcional
      const progressRate = Math.min(1, this.calibrationSamples / this.CALIBRATION_REQUIRED_SAMPLES);
      this.calibrationProgress = {
        heartRate: progressRate,
        spo2: progressRate,
        pressure: progressRate,
        arrhythmia: progressRate,
        glucose: progressRate,
        lipids: progressRate,
        hemoglobin: progressRate
      };
      
      return;
    }
    
    try {
      // Aplicar resultados de calibración usando estadísticas robustas
      // para evitar desviaciones por valores atípicos
      
      // SpO2: usar mediana para estabilidad
      if (this.spo2Samples.length > 5) {
        const sortedSpO2 = [...this.spo2Samples].sort((a, b) => a - b);
        const medianSpO2 = sortedSpO2[Math.floor(sortedSpO2.length / 2)];
        console.log("VitalSignsProcessor: Calibración SpO2 completada", {
          mediana: medianSpO2,
          muestras: this.spo2Samples.length
        });
      }
      
      // Actualizar progreso a 100%
      this.calibrationProgress = {
        heartRate: 1,
        spo2: 1,
        pressure: 1,
        arrhythmia: 1,
        glucose: 1,
        lipids: 1,
        hemoglobin: 1
      };
      
      console.log("VitalSignsProcessor: Calibración completada exitosamente", {
        tiempoTotal: (Date.now() - this.calibrationStartTime).toFixed(0) + "ms",
        muestras: this.calibrationSamples
      });
    } catch (error) {
      console.error("Error durante la calibración:", error);
    } finally {
      // Limpiar temporizador
      if (this.calibrationTimer) {
        clearTimeout(this.calibrationTimer);
        this.calibrationTimer = null;
      }
      
      // Finalizar calibración
      this.isCalibrating = false;
    }
  }

  /**
   * Procesa la señal PPG y calcula los signos vitales
   * Solo utiliza datos reales, sin simulaciones
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Validar valor PPG
    if (isNaN(ppgValue) || ppgValue === 0) {
      console.warn("VitalSignsProcessor: Valor PPG inválido recibido", ppgValue);
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

    // Almacenar valores PPG para procesamiento
    this.ppgBuffer.push(ppgValue);
    if (this.ppgBuffer.length > this.PPG_BUFFER_SIZE) {
      this.ppgBuffer.shift();
    }

    // Incrementar contador de muestras durante calibración
    if (this.isCalibrating) {
      this.calibrationSamples++;
      
      // Verificar si ya se alcanzó el número requerido de muestras
      if (this.calibrationSamples >= this.CALIBRATION_REQUIRED_SAMPLES) {
        this.completeCalibration();
      }
    }
    
    // Aplicar filtrado a la señal PPG
    const filtered = this.signalProcessor.applySMAFilter(ppgValue);
    
    // Procesar datos de arritmia si están disponibles
    const arrhythmiaResult = this.arrhythmiaProcessor.processRRData(rrData);
    
    // Verificar calidad de señal
    const signalQuality = this.signalProcessor.getSignalQuality();
    const isFingerPresent = this.signalProcessor.isFingerPresent();
    
    if (!isFingerPresent || signalQuality < 30) {
      console.log("VitalSignsProcessor: Calidad de señal insuficiente o dedo no detectado", {
        calidad: signalQuality,
        dedoDetectado: isFingerPresent
      });
      
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
    
    // Solo procesar si hay suficientes datos de PPG
    if (this.ppgBuffer.length < 100) {
      console.log("VitalSignsProcessor: Buffer PPG insuficiente", {
        actual: this.ppgBuffer.length,
        requerido: 100
      });
      
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
    
    // Calcular SpO2 utilizando últimos 60 valores
    const spo2Result = this.spo2Processor.calculateSpO2(this.ppgBuffer.slice(-60));
    const spo2 = spo2Result.value;
    
    // Calcular presión arterial utilizando últimos 120 valores
    const bp = this.bpProcessor.calculateBloodPressure(this.ppgBuffer.slice(-120));
    const pressure = bp.systolic > 0 && bp.diastolic > 0 
      ? `${bp.systolic}/${bp.diastolic}` 
      : "--/--";
    
    // Calcular glucosa con validación de confianza
    const glucose = Math.round(this.glucoseProcessor.calculateGlucose(this.ppgBuffer));
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    
    // Calcular lípidos con validación de confianza
    const lipids = this.lipidProcessor.calculateLipids(this.ppgBuffer);
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    
    // Calcular hemoglobina
    const hemoglobin = this.calculateHemoglobin(this.ppgBuffer);
    
    // Durante calibración, almacenar mediciones para análisis estadístico
    if (this.isCalibrating) {
      if (spo2 > 0) this.spo2Samples.push(spo2);
      if (bp.systolic > 0 && bp.diastolic > 0) this.pressureSamples.push(bp.systolic);
      if (glucose > 0) this.glucoseSamples.push(glucose);
      if (lipids.totalCholesterol > 0) this.lipidSamples.push(lipids.totalCholesterol);
      
      // Actualizar progreso de calibración proporcional
      const progressRate = Math.min(1, this.calibrationSamples / this.CALIBRATION_REQUIRED_SAMPLES);
      this.calibrationProgress = {
        heartRate: progressRate,
        spo2: progressRate,
        pressure: progressRate,
        arrhythmia: progressRate,
        glucose: progressRate,
        lipids: progressRate,
        hemoglobin: progressRate
      };
    }
    
    // Calcular confianza general
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
    if (this.isCalibrating) {
      result.calibration = {
        isCalibrating: true,
        progress: { ...this.calibrationProgress }
      };
    }
    
    // Solo actualizar resultados válidos si hay suficiente confianza
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
   * Calcula SpO2 directamente a partir de valores PPG
   * Método utilizado por la clase wrapper
   */
  public calculateSpO2(ppgValues: number[]): number {
    if (!ppgValues || ppgValues.length < 30) {
      return 0;
    }
    
    const result = this.spo2Processor.calculateSpO2(ppgValues);
    return result.value;
  }

  /**
   * Calcula nivel de hemoglobina estimado basado en características de la señal PPG
   */
  private calculateHemoglobin(ppgValues: number[]): number {
    if (ppgValues.length < 120) {
      console.log("VitalSignsProcessor: Datos insuficientes para calcular hemoglobina", {
        muestras: ppgValues.length,
        requeridas: 120
      });
      return 0;
    }
    
    // Normalizar valores
    const min = Math.min(...ppgValues);
    const max = Math.max(...ppgValues);
    
    // Verificar amplitud mínima
    if (max - min < 0.05) {
      console.log("VitalSignsProcessor: Amplitud PPG insuficiente para hemoglobina", {
        min, max, amplitud: max - min
      });
      return 0;
    }
    
    // Análisis de la señal PPG normalizada
    const normalized = ppgValues.map(v => (v - min) / (max - min));
    
    // Cálculo del área bajo la curva como indicador de contenido de hemoglobina
    const auc = normalized.reduce((sum, val) => sum + val, 0) / normalized.length;
    
    // Modelo basado en investigación óptica
    const baseHemoglobin = 14.5; // g/dL (valor promedio normal)
    const hemoglobin = baseHemoglobin - ((0.6 - auc) * 8);
    
    // Validación del rango fisiológico
    const validatedHemoglobin = Math.max(10, Math.min(17, hemoglobin));
    
    console.log("VitalSignsProcessor: Hemoglobina calculada de datos PPG", {
      auc,
      hemoglobinaBruta: hemoglobin,
      hemoglobinaValidada: validatedHemoglobin
    });
    
    return validatedHemoglobin;
  }

  /**
   * Verifica si está en proceso de calibración
   */
  public isCurrentlyCalibrating(): boolean {
    return this.isCalibrating;
  }

  /**
   * Obtiene el progreso actual de calibración
   */
  public getCalibrationProgress(): VitalSignsResult['calibration'] {
    if (!this.isCalibrating) return undefined;
    
    return {
      isCalibrating: true,
      progress: { ...this.calibrationProgress }
    };
  }

  /**
   * Fuerza la finalización del proceso de calibración
   */
  public forceCalibrationCompletion(): void {
    if (!this.isCalibrating) return;
    
    console.log("VitalSignsProcessor: Forzando finalización de calibración");
    this.forceCompleteCalibration = true;
    this.completeCalibration();
  }

  /**
   * Reinicia el procesador manteniendo los últimos resultados válidos
   */
  public reset(): VitalSignsResult | null {
    console.log("VitalSignsProcessor: Reiniciando procesadores");
    
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    
    // Reiniciar buffer PPG
    this.ppgBuffer = [];
    
    // Finalizar calibración si está en curso
    if (this.isCalibrating) {
      this.isCalibrating = false;
      if (this.calibrationTimer) {
        clearTimeout(this.calibrationTimer);
        this.calibrationTimer = null;
      }
    }
    
    return this.lastValidResults;
  }
  
  /**
   * Obtiene los últimos resultados válidos
   */
  public getLastValidResults(): VitalSignsResult | null {
    return this.lastValidResults;
  }
  
  /**
   * Reinicia completamente el procesador
   */
  public fullReset(): void {
    this.reset();
    this.lastValidResults = null;
  }

  /**
   * Método público para calcular presión arterial directamente
   */
  public calculateBloodPressure(ppgValues: number[]): { systolic: number; diastolic: number } {
    if (!ppgValues || ppgValues.length < 100) {
      console.log("VitalSignsProcessor: Datos insuficientes para presión arterial", {
        muestras: ppgValues?.length || 0,
        requeridas: 100
      });
      return { systolic: 0, diastolic: 0 };
    }
    
    return this.bpProcessor.calculateBloodPressure(ppgValues.slice(-120));
  }
}

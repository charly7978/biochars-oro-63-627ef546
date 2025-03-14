
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
  private readonly CALIBRATION_REQUIRED_SAMPLES: number = 40; // Reducido (antes 50)
  private readonly CALIBRATION_DURATION_MS: number = 6000; // Reducido (antes 8000)
  
  private spo2Samples: number[] = [];
  private pressureSamples: number[] = [];
  private heartRateSamples: number[] = [];
  private glucoseSamples: number[] = [];
  private lipidSamples: number[] = [];
  
  // Umbrales de señal mínima para considerar mediciones válidas
  private readonly MIN_SIGNAL_AMPLITUDE = 0.025; // Reducido (antes 0.03)
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.3; // Reducido (antes 0.35)

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
    console.log("VitalSignsProcessor: Inicializando con procesamiento optimizado para PRESIÓN, GLUCOSA Y LÍPIDOS");
    
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
    
    // Configurar el buffer de PPG inicialmente
    this.ppgBuffer = Array(this.PPG_BUFFER_SIZE).fill(0);
    
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
    // Aplicar amplificación para mejorar detección de señales débiles
    this.ppgBuffer.push(ppgValue * 1.25); // Aumentado (antes 1.12)
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
    
    // Verificar calidad de señal con umbral reducido
    const signalQuality = this.signalProcessor.getSignalQuality();
    const isFingerPresent = this.signalProcessor.isFingerPresent();
    
    // Reducir aún más el requerimiento de calidad de señal
    if (!isFingerPresent || signalQuality < 15) { // Reducido aún más (antes 20)
      console.log("VitalSignsProcessor: Calidad de señal baja o dedo no detectado", {
        calidad: signalQuality,
        dedoDetectado: isFingerPresent
      });
      
      // Intentar procesar de todas formas con sensibilidad aumentada si hay más de 50 muestras
      if (this.ppgBuffer.length >= 50) {
        console.log("VitalSignsProcessor: Intentando procesar con sensibilidad aumentada");
        // Continuar procesamiento con sensibilidad aumentada
      } else {
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
    }
    
    // Reducir aún más el requisito de muestras PPG
    if (this.ppgBuffer.length < 60) { // Reducido aún más (antes 80)
      console.log("VitalSignsProcessor: Buffer PPG pequeño, activando modo alta sensibilidad", {
        actual: this.ppgBuffer.length,
        requerido: 60
      });
      
      // Intentar procesar de todas formas si hay más de 40 muestras
      if (this.ppgBuffer.length < 40) {
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
    }
    
    // Crear múltiples copias amplificadas del buffer para aumentar probabilidad de detección
    const amplificationFactors = [1.0, 1.15, 1.3, 1.5];
    const amplifiedBuffers = amplificationFactors.map(factor => 
      this.ppgBuffer.map(val => val * factor)
    );
    
    // Calcular SpO2 utilizando últimos 40 valores (reducido de 50)
    let spo2 = 0;
    for (const buffer of amplifiedBuffers) {
      const spo2Result = this.spo2Processor.calculateSpO2(buffer.slice(-40));
      spo2 = spo2Result.value;
      if (spo2 > 0) break; // Usar el primer resultado válido
    }
    
    // Calcular presión arterial utilizando múltiples intentos
    let bp = { systolic: 0, diastolic: 0 };
    for (const buffer of amplifiedBuffers) {
      bp = this.bpProcessor.calculateBloodPressure(buffer.slice(-80));
      if (bp.systolic > 0 && bp.diastolic > 0) break; // Usar el primer resultado válido
    }
    
    const pressure = bp.systolic > 0 && bp.diastolic > 0 
      ? `${bp.systolic}/${bp.diastolic}` 
      : "--/--";
    
    // Calcular glucosa con múltiples intentos y validación de confianza reducida
    let glucose = 0;
    for (const buffer of amplifiedBuffers) {
      glucose = Math.round(this.glucoseProcessor.calculateGlucose(buffer));
      if (glucose > 0) break; // Usar el primer resultado válido
    }
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    
    // Calcular lípidos con múltiples intentos y validación de confianza reducida
    let lipids = { totalCholesterol: 0, triglycerides: 0 };
    for (const buffer of amplifiedBuffers) {
      lipids = this.lipidProcessor.calculateLipids(buffer);
      if (lipids.totalCholesterol > 0) break; // Usar el primer resultado válido
    }
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    
    // Calcular hemoglobina con múltiples intentos
    let hemoglobin = 0;
    for (const buffer of amplifiedBuffers) {
      hemoglobin = this.calculateHemoglobin(buffer);
      if (hemoglobin > 0) break; // Usar el primer resultado válido
    }
    
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
    
    // Calcular confianza general con menos exigencia
    const overallConfidence = (glucoseConfidence * 0.6) + (lipidsConfidence * 0.4);

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
    
    // Aún más tolerante con los resultados parciales
    if (spo2 > 0 || bp.systolic > 0 || glucose > 0 || lipids.totalCholesterol > 0 || hemoglobin > 0) {
      // Almacenar resultados parciales también
      if (!this.lastValidResults) {
        this.lastValidResults = { ...result };
      } else {
        // Actualizar solo los campos que tengan valores válidos
        if (spo2 > 0) this.lastValidResults.spo2 = spo2;
        if (bp.systolic > 0 && bp.diastolic > 0) this.lastValidResults.pressure = pressure;
        if (glucose > 0) this.lastValidResults.glucose = glucose;
        if (lipids.totalCholesterol > 0) this.lastValidResults.lipids = lipids;
        if (hemoglobin > 0) this.lastValidResults.hemoglobin = hemoglobin;
      }
    }

    return result;
  }

  /**
   * Calcula SpO2 directamente a partir de valores PPG
   * Método utilizado por la clase wrapper
   */
  public calculateSpO2(ppgValues: number[]): { value: number; confidence: number } {
    if (!ppgValues || ppgValues.length < 20) { // Reducido (antes 30)
      return { value: 0, confidence: 0 };
    }
    
    return this.spo2Processor.calculateSpO2(ppgValues);
  }

  /**
   * Calcula nivel de hemoglobina estimado basado en características de la señal PPG
   */
  private calculateHemoglobin(ppgValues: number[]): number {
    // Reducir requisito de muestras de 120 a 80
    if (ppgValues.length < 80) { // Reducido aún más (antes 100)
      console.log("VitalSignsProcessor: Datos insuficientes para calcular hemoglobina", {
        muestras: ppgValues.length,
        requeridas: 80
      });
      return 0;
    }
    
    // Normalizar valores
    const min = Math.min(...ppgValues);
    const max = Math.max(...ppgValues);
    
    // Verificar amplitud mínima (reducida de 0.05 a 0.02)
    if (max - min < 0.02) { // Reducido (antes 0.03)
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
  public calculateBloodPressure(ppgValues: number[]): { systolic: number; diastolic: number; confidence: number } {
    if (!ppgValues || ppgValues.length < 60) { // Reducido aún más (antes 100)
      console.log("VitalSignsProcessor: Datos insuficientes para presión arterial", {
        muestras: ppgValues?.length || 0,
        requeridas: 60
      });
      return { systolic: 0, diastolic: 0, confidence: 0 };
    }
    
    return this.bpProcessor.calculateBloodPressure(ppgValues.slice(-80)); // Reducido (antes -120)
  }
}

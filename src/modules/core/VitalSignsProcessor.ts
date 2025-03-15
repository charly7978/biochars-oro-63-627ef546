
/**
 * NOTA IMPORTANTE: Este es el módulo principal de procesamiento de signos vitales.
 * Las interfaces principales están en index.tsx y PPGSignalMeter.tsx que son INTOCABLES.
 */

import { SpO2Processor } from './SpO2Processor';
import { BloodPressureProcessor } from './BloodPressureProcessor';
import { ArrhythmiaProcessor, RRData } from './ArrhythmiaProcessor';
import { SignalProcessor } from './SignalProcessor';
import { formatBloodPressure } from '../../utils/vitalSignsUtils';

export interface VitalSignsResult {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  lastArrhythmiaData?: { 
    timestamp: number; 
    rmssd: number; 
    rrVariation: number; 
  } | null;
  calibration?: {
    isCalibrating: boolean;
    progress: {
      heartRate: number;
      spo2: number;
      pressure: number;
      arrhythmia: number;
    };
  };
}

/**
 * Procesador principal de signos vitales
 * Integra los diferentes procesadores especializados para calcular métricas de salud
 */
export class VitalSignsProcessor {
  private spo2Processor: SpO2Processor;
  private bpProcessor: BloodPressureProcessor;
  private arrhythmiaProcessor: ArrhythmiaProcessor;
  private signalProcessor: SignalProcessor;
  
  private lastValidResults: VitalSignsResult | null = null;
  private isCalibrating: boolean = false;
  private calibrationStartTime: number = 0;
  private calibrationSamples: number = 0;
  private readonly CALIBRATION_REQUIRED_SAMPLES: number = 50;
  private readonly CALIBRATION_DURATION_MS: number = 8000;
  
  private calibrationProgress = {
    heartRate: 0,
    spo2: 0,
    pressure: 0,
    arrhythmia: 0
  };
  
  private forceCompleteCalibration: boolean = false;
  private calibrationTimer: any = null;

  constructor() {
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    
    console.log("VitalSignsProcessor: Inicializado con configuración optimizada");
  }

  /**
   * Inicia el proceso de calibración para mejorar la precisión de las mediciones
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

    // Reiniciar progreso de calibración
    this.calibrationProgress = {
      heartRate: 0,
      spo2: 0,
      pressure: 0,
      arrhythmia: 0
    };

    // Configurar temporizador para completar la calibración después del tiempo máximo
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
   * Completa el proceso de calibración y aplica los resultados
   */
  private completeCalibration(): void {
    if (!this.isCalibrating) {
      return;
    }
    
    // Si no hay suficientes muestras, no completar la calibración
    // a menos que sea forzado
    if (this.calibrationSamples < this.CALIBRATION_REQUIRED_SAMPLES && !this.forceCompleteCalibration) {
      console.log(`VitalSignsProcessor: Calibración incompleta (${this.calibrationSamples}/${this.CALIBRATION_REQUIRED_SAMPLES} muestras)`);
      
      // Actualizar progreso proporcional
      const progressRate = Math.min(1, this.calibrationSamples / this.CALIBRATION_REQUIRED_SAMPLES);
      this.calibrationProgress = {
        heartRate: progressRate,
        spo2: progressRate,
        pressure: progressRate,
        arrhythmia: progressRate
      };
      
      return;
    }
    
    try {
      // Actualizar progreso a 100%
      this.calibrationProgress = {
        heartRate: 1,
        spo2: 1,
        pressure: 1,
        arrhythmia: 1
      };
      
      console.log("VitalSignsProcessor: Calibración completada exitosamente", {
        tiempoTotal: (Date.now() - this.calibrationStartTime).toFixed(0) + "ms",
        muestras: this.calibrationSamples
      });
    } catch (error) {
      console.error("Error durante la calibración:", error);
    } finally {
      // Limpiar temporizador y marcar calibración como completada
      if (this.calibrationTimer) {
        clearTimeout(this.calibrationTimer);
        this.calibrationTimer = null;
      }
      
      // Marcar calibración como completada
      this.isCalibrating = false;
    }
  }

  /**
   * Procesa la señal PPG y calcula todos los signos vitales
   */
  public processSignal(
    ppgValue: number,
    rrData?: RRData
  ): VitalSignsResult {
    // Aplicar filtrado a la señal PPG
    const processed = this.signalProcessor.processSignal(ppgValue);
    
    // Incrementar contador de muestras durante calibración
    if (this.isCalibrating) {
      this.calibrationSamples++;
      
      // Verificar si ya se alcanzó el número requerido de muestras
      if (this.calibrationSamples >= this.CALIBRATION_REQUIRED_SAMPLES) {
        this.completeCalibration();
      }
      
      // Actualizar progreso de calibración proporcional
      const progressRate = Math.min(1, this.calibrationSamples / this.CALIBRATION_REQUIRED_SAMPLES);
      this.calibrationProgress = {
        heartRate: progressRate,
        spo2: progressRate,
        pressure: progressRate,
        arrhythmia: progressRate
      };
    }
    
    // Procesar datos de arritmia si están disponibles
    const arrhythmiaResult = this.arrhythmiaProcessor.processRRData(rrData);
    
    // Obtener los valores PPG para procesamiento
    const ppgValues = this.signalProcessor.getPPGValues();
    
    // Solo procesar si hay suficientes datos de PPG
    if (ppgValues.length < 100) {
      return this.getLastValidResults() || {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "--"
      };
    }
    
    // Calcular SpO2
    const spo2 = this.spo2Processor.calculateSpO2(ppgValues.slice(-60));
    
    // Calcular presión arterial
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-120));
    const pressure = formatBloodPressure(bp);
    
    // Preparar resultado con todas las métricas calculadas
    const result: VitalSignsResult = {
      spo2,
      pressure,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      lastArrhythmiaData: arrhythmiaResult.lastArrhythmiaData
    };
    
    // Incluir información de calibración si está en proceso
    if (this.isCalibrating) {
      result.calibration = {
        isCalibrating: true,
        progress: { ...this.calibrationProgress }
      };
    }
    
    // Solo actualizar resultados válidos si hay suficiente confianza
    if (spo2 > 0 && bp.systolic > 0 && bp.diastolic > 0) {
      this.lastValidResults = { ...result };
    }

    return result;
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
    
    this.forceCompleteCalibration = true;
    this.completeCalibration();
  }

  /**
   * Reinicia el procesador manteniendo los últimos resultados válidos
   */
  public reset(): VitalSignsResult | null {
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalProcessor.reset();
    
    // Si hay una calibración en curso, finalizarla
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
   * Reinicia completamente el procesador, eliminando datos de calibración y resultados previos
   */
  public fullReset(): void {
    this.reset();
    this.lastValidResults = null;
  }
}

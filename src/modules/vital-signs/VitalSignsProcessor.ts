
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

import { SignalProcessor } from './signal-processor';
import { SpO2Calculator } from './spo2-calculator';
import { BloodPressureCalculator } from './blood-pressure-calculator';
import { ArrhythmiaDetector } from './arrhythmia-detector';

export interface VitalSignsResult {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  signalQuality: number;
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  };
  calibration?: {
    progress: {
      heartRate: number;
      spo2: number;
      pressure: number;
      arrhythmia: number;
    }
  };
  rawPPG?: number;
}

export class VitalSignsProcessor {
  private signalProcessor: SignalProcessor;
  private spo2Calculator: SpO2Calculator;
  private bpCalculator: BloodPressureCalculator;
  private arrhythmiaDetector: ArrhythmiaDetector;
  private lastValidResult: VitalSignsResult | null = null;

  constructor() {
    this.signalProcessor = new SignalProcessor();
    this.spo2Calculator = new SpO2Calculator();
    this.bpCalculator = new BloodPressureCalculator();
    this.arrhythmiaDetector = new ArrhythmiaDetector();
    
    console.log("VitalSignsProcessor: Inicializado con nueva arquitectura modular");
  }

  /**
   * Procesa una señal PPG y datos RR para obtener signos vitales
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Procesar la señal PPG
    const filteredValue = this.signalProcessor.processSignal(ppgValue);
    
    // Actualizar datos de arritmia
    this.arrhythmiaDetector.updateRRIntervals(rrData);

    // Calcular SpO2
    const recentValues = this.signalProcessor.getRecentValues(60);
    const spo2 = this.spo2Calculator.calculateSpO2(recentValues);
    
    // Calcular presión arterial
    const bp = this.bpCalculator.calculateBloodPressure(recentValues);
    const pressureString = `${bp.systolic}/${bp.diastolic}`;

    // Obtener estado de arritmia
    const arrhythmiaStatus = this.arrhythmiaDetector.getArrhythmiaStatus();
    let arrhythmiaCount = 0;
    if (this.arrhythmiaDetector.hasArrhythmia()) {
      arrhythmiaCount = 1;
    }

    // Calcular métricas de arritmia
    const rmssd = this.arrhythmiaDetector.calculateRMSSD();
    const rrVariation = this.arrhythmiaDetector.calculateRRVariation();
    
    // Datos de última arritmia
    const lastArrhythmiaData = {
      timestamp: Date.now(),
      rmssd: rmssd || 0,
      rrVariation: rrVariation || 0
    };

    // Calcular calidad de señal
    const signalQuality = Math.min(100, Math.max(0, recentValues.length / 3));

    // Calcular progreso de calibración
    const calibrationProgress = {
      heartRate: Math.min(1, recentValues.length / 60),
      spo2: Math.min(1, recentValues.length / 90),
      pressure: Math.min(1, recentValues.length / 150),
      arrhythmia: Math.min(1, this.arrhythmiaDetector.isInLearningPhase() ? 0.5 : 1)
    };

    // Crear resultado
    const result: VitalSignsResult = {
      spo2,
      pressure: pressureString,
      arrhythmiaStatus: `${arrhythmiaStatus}|${arrhythmiaCount}`,
      signalQuality,
      lastArrhythmiaData,
      calibration: {
        progress: calibrationProgress
      },
      rawPPG: ppgValue
    };

    // Guardar último resultado válido
    if (spo2 > 90 && bp.systolic > 0 && bp.diastolic > 0) {
      this.lastValidResult = { ...result };
    }

    return result;
  }

  /**
   * Reinicia el procesador pero conserva el último resultado válido
   */
  public reset(): VitalSignsResult | null {
    const savedResult = this.lastValidResult;
    
    this.signalProcessor.reset();
    this.spo2Calculator.reset();
    this.bpCalculator.reset();
    this.arrhythmiaDetector.reset();
    
    console.log("VitalSignsProcessor: Reset con conservación de último resultado válido");
    
    return savedResult;
  }

  /**
   * Reinicia completamente el procesador y todos sus datos
   */
  public fullReset(): void {
    this.signalProcessor.reset();
    this.spo2Calculator.reset();
    this.bpCalculator.reset();
    this.arrhythmiaDetector.reset();
    this.lastValidResult = null;
    
    console.log("VitalSignsProcessor: Reset completo sin conservación de resultados");
  }

  /**
   * Devuelve el último resultado válido
   */
  public get lastValidResults(): VitalSignsResult | null {
    return this.lastValidResult;
  }
}

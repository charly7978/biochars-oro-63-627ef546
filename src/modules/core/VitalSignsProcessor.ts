
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
  glucose: number | { value: number; trend: string };
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  hemoglobin: number;
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
  advanced?: any; // Para extensibilidad futura
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
  
  constructor() {
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    
    console.log("VitalSignsProcessor: Inicializado con configuración optimizada");
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
    
    // Procesar datos de arritmia si están disponibles
    const arrhythmiaResult = this.arrhythmiaProcessor.processRRData(rrData);
    
    // Obtener los valores PPG para procesamiento
    const ppgValues = this.signalProcessor.getPPGValues();
    
    // Solo procesar si hay suficientes datos de PPG
    if (ppgValues.length < 100) {
      return this.getLastValidResults() || {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "PROCESANDO...",
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
    const pressure = formatBloodPressure(bp);
    
    // Preparar resultado con todas las métricas calculadas
    const result: VitalSignsResult = {
      spo2,
      pressure,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      },
      hemoglobin: 0,
      lastArrhythmiaData: arrhythmiaResult.lastArrhythmiaData
    };
    
    // Solo actualizar resultados válidos si hay suficiente confianza
    if (spo2 > 0 && bp.systolic > 0 && bp.diastolic > 0) {
      this.lastValidResults = { ...result };
    }

    return result;
  }

  /**
   * Reinicia el procesador manteniendo los últimos resultados válidos
   */
  public reset(): VitalSignsResult | null {
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalProcessor.reset();
    
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

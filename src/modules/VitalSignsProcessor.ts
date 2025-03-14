
import { VitalSignsProcessor as NewVitalSignsProcessor } from './vital-signs/VitalSignsProcessor';
import './HeartBeatProcessor.extension';

/**
 * Wrapper para mantener compatibilidad con implementación original
 * mientras se usa la versión refactorizada.
 */
export class VitalSignsProcessor {
  private processor: NewVitalSignsProcessor;
  public spo2Processor: any; // Exposición pública del procesador de SpO2
  
  // Constantes para compatibilidad
  private readonly WINDOW_SIZE = 300;
  private readonly SPO2_CALIBRATION_FACTOR = 1.02;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.05;
  private readonly SPO2_WINDOW = 10;
  private readonly SMA_WINDOW = 3;
  private readonly RR_WINDOW_SIZE = 5;
  private readonly RMSSD_THRESHOLD = 25;
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 3000;
  private readonly PEAK_THRESHOLD = 0.3;
  
  constructor() {
    console.log("VitalSignsProcessor: Inicializando con enfoque en datos reales");
    this.processor = new NewVitalSignsProcessor();
    
    // Importante: Hacer referencia al procesador de SpO2 para acceso directo
    this.spo2Processor = this.processor.spo2Processor;
    
    // Registro global para otros componentes
    if (typeof window !== 'undefined') {
      (window as any).vitalSignsProcessor = this.processor;
      console.log('VitalSignsProcessor: Registrado globalmente a través del wrapper');
    }
  }
  
  /**
   * Procesa señal PPG y calcula signos vitales
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ) {
    if (isNaN(ppgValue) || ppgValue === 0) {
      console.warn("VitalSignsProcessor: Valor PPG inválido recibido", ppgValue);
      return {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "--"
      };
    }
    
    return this.processor.processSignal(ppgValue, rrData);
  }
  
  /**
   * Reinicia todos los procesadores
   */
  public reset(): void {
    console.log("VitalSignsProcessor: Reiniciando todos los procesadores");
    this.processor.reset();
  }
  
  /**
   * Método proxy para cálculo directo de presión arterial
   */
  public calculateBloodPressure(ppgValues: number[]): { systolic: number; diastolic: number } {
    // Validación estricta de datos
    if (!ppgValues || ppgValues.length < 60) {
      console.warn("VitalSignsProcessor: Datos insuficientes para calcular presión arterial", {
        longitud: ppgValues?.length || 0,
        requeridos: 60
      });
      return { systolic: 0, diastolic: 0 }; // Indicar medición inválida
    }
    
    return this.processor.calculateBloodPressure(ppgValues);
  }
  
  /**
   * Método proxy para cálculo directo de SpO2
   */
  public calculateSpO2(ppgValues: number[]): number {
    // Validación estricta de datos
    if (!ppgValues || ppgValues.length < 30) {
      console.warn("VitalSignsProcessor: Datos insuficientes para calcular SpO2", {
        longitud: ppgValues?.length || 0,
        requeridos: 30
      });
      return 0; // Indicar medición inválida
    }
    
    // Verificar disponibilidad del procesador y método
    if (this.processor.spo2Processor && typeof this.processor.spo2Processor.calculateSpO2 === 'function') {
      const result = this.processor.spo2Processor.calculateSpO2(ppgValues);
      const value = typeof result === 'object' ? result.value : result;
      
      console.log("VitalSignsProcessor: SpO2 calculado de datos PPG reales", {
        resultado: value,
        muestras: ppgValues.length
      });
      
      return value;
    }
    
    console.error("VitalSignsProcessor: Procesador SpO2 no disponible");
    return 0; // Indicar imposibilidad de medición
  }
}

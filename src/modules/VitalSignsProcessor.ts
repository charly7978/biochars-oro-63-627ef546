
import { VitalSignsProcessor as NewVitalSignsProcessor } from './vital-signs/VitalSignsProcessor';
import './HeartBeatProcessor.extension';
import { GlucoseProcessor } from './vital-signs/glucose-processor';
import { LipidProcessor } from './vital-signs/lipid-processor';

/**
 * Wrapper para mantener compatibilidad con implementación original
 * mientras se usa la versión refactorizada.
 */
export class VitalSignsProcessor {
  private processor: NewVitalSignsProcessor;
  public spo2Processor: any; // Exposición pública del procesador de SpO2
  public glucoseProcessor: GlucoseProcessor; // Exposición pública del procesador de glucosa
  public lipidProcessor: LipidProcessor; // Exposición pública del procesador de lípidos
  
  // Constantes para compatibilidad
  private readonly WINDOW_SIZE = 300;
  private readonly SPO2_CALIBRATION_FACTOR = 1.05; // Ajustado para mayor sensibilidad
  private readonly PERFUSION_INDEX_THRESHOLD = 0.035; // Reducido para mayor sensibilidad
  private readonly SPO2_WINDOW = 8; // Reducido para respuesta más rápida
  private readonly SMA_WINDOW = 3;
  private readonly RR_WINDOW_SIZE = 5;
  private readonly RMSSD_THRESHOLD = 20; // Ajustado para mejor detección
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 2500; // Reducido para aprendizaje más rápido
  private readonly PEAK_THRESHOLD = 0.25; // Reducido para mejor detección de picos
  
  constructor() {
    console.log("VitalSignsProcessor: Inicializando con enfoque en datos reales");
    // Inicializar procesador sin pasar argumentos
    this.processor = new NewVitalSignsProcessor();
    
    // Inicializar procesadores sin pasar argumentos
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
    
    // Importante: Hacer referencia al procesador de SpO2 para acceso directo
    this.spo2Processor = this.processor.spo2Processor;
    
    // Configurar manualmente para mayor sensibilidad después de inicialización
    this.configureEnhancedSensitivity();
    
    // Registro global para otros componentes
    if (typeof window !== 'undefined') {
      (window as any).vitalSignsProcessor = this.processor;
      (window as any).glucoseProcessor = this.glucoseProcessor; // Registrar globalmente
      (window as any).lipidProcessor = this.lipidProcessor; // Registrar globalmente
      console.log('VitalSignsProcessor: Registrado globalmente a través del wrapper');
      console.log('GlucoseProcessor: Registrado globalmente para acceso directo');
      console.log('LipidProcessor: Registrado globalmente para acceso directo');
    }
  }
  
  /**
   * Configura parámetros de alta sensibilidad en los procesadores
   */
  private configureEnhancedSensitivity(): void {
    // Aquí configuramos manualmente parámetros para mejorar sensibilidad
    console.log("VitalSignsProcessor: Configurando procesadores para sensibilidad mejorada");
    
    // Intentar acceder y modificar los parámetros internos para mayor sensibilidad
    if (this.processor && this.processor.signalProcessor) {
      // Reducir umbrales de calidad de señal
      (this.processor.signalProcessor as any).MIN_SIGNAL_AMPLITUDE = 0.03; // Reducido de 0.05
      (this.processor.signalProcessor as any).MIN_SIGNAL_QUALITY = 25; // Reducido de 30
    }
    
    if (this.processor && this.processor.bpProcessor) {
      // Aumentar sensibilidad de presión
      (this.processor.bpProcessor as any).MIN_SIGNAL_QUALITY = 0.3; // Reducido de 0.4
      (this.processor.bpProcessor as any).MIN_SAMPLES = 25; // Reducido de 30
    }
    
    if (this.processor && this.processor.spo2Processor) {
      // Aumentar sensibilidad SpO2
      (this.processor.spo2Processor as any).MIN_PERFUSION_INDEX = 0.03; // Reducido de 0.05
      (this.processor.spo2Processor as any).MIN_SIGNAL_QUALITY = 40; // Reducido de 50
    }
    
    // Configurar procesador de glucosa para mayor sensibilidad
    if (this.glucoseProcessor) {
      (this.glucoseProcessor as any).MIN_SIGNAL_QUALITY = 40; // Reducido de 50
    }
    
    // Configurar procesador de lípidos para mayor sensibilidad
    if (this.lipidProcessor) {
      (this.lipidProcessor as any).MIN_SIGNAL_QUALITY = 40; // Reducido de 50
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
    
    // Amplificar ligeramente los valores PPG para mejorar detección
    const amplifiedValue = ppgValue * 1.15;
    return this.processor.processSignal(amplifiedValue, rrData);
  }
  
  /**
   * Reinicia todos los procesadores
   */
  public reset(): void {
    console.log("VitalSignsProcessor: Reiniciando todos los procesadores");
    this.processor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
  }
  
  /**
   * Método proxy para cálculo directo de presión arterial
   */
  public calculateBloodPressure(ppgValues: number[]): { systolic: number; diastolic: number } {
    // Validación menos estricta de datos para permitir más mediciones
    if (!ppgValues || ppgValues.length < 40) { // Reducido de 60 a 40
      console.warn("VitalSignsProcessor: Datos insuficientes para calcular presión arterial", {
        longitud: ppgValues?.length || 0,
        requeridos: 40
      });
      return { systolic: 0, diastolic: 0 }; // Indicar medición inválida
    }
    
    // Amplificar valores para mejor detección
    const amplifiedValues = ppgValues.map(val => val * 1.12);
    return this.processor.calculateBloodPressure(amplifiedValues);
  }
  
  /**
   * Método proxy para cálculo directo de SpO2
   */
  public calculateSpO2(ppgValues: number[]): number {
    // Validación menos estricta de datos para permitir más mediciones
    if (!ppgValues || ppgValues.length < 20) { // Reducido de 30 a 20
      console.warn("VitalSignsProcessor: Datos insuficientes para calcular SpO2", {
        longitud: ppgValues?.length || 0,
        requeridos: 20
      });
      return 0; // Indicar medición inválida
    }
    
    // Verificar disponibilidad del procesador y método
    if (this.processor.spo2Processor && typeof this.processor.spo2Processor.calculateSpO2 === 'function') {
      // Amplificar valores para mejor detección
      const amplifiedValues = ppgValues.map(val => val * 1.08);
      const result = this.processor.spo2Processor.calculateSpO2(amplifiedValues);
      // Manejar tanto objeto de resultado como valor directo para compatibilidad
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

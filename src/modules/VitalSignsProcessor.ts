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
    console.log("VitalSignsProcessor: Inicializando con enfoque en PRESIÓN, GLUCOSA Y LÍPIDOS");
    
    // Inicializar procesador principal
    this.processor = new NewVitalSignsProcessor();
    
    // Inicializar procesadores directamente para mejor control
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
    
    // Importante: Hacer referencia al procesador de SpO2 para acceso directo
    this.spo2Processor = this.processor.spo2Processor;
    
    // Configurar manualmente para mayor sensibilidad después de inicialización
    this.configureEnhancedSensitivity();
    
    // Registro global para otros componentes - VERIFICAR QUE NO HAYA DUPLICACIÓN
    if (typeof window !== 'undefined') {
      // Eliminar instancias anteriores si existen para evitar duplicación
      if ((window as any).vitalSignsProcessor) {
        console.log('VitalSignsProcessor: Eliminando instancia anterior para evitar duplicación');
      }
      if ((window as any).glucoseProcessor) {
        console.log('GlucoseProcessor: Eliminando instancia anterior para evitar duplicación');
      }
      if ((window as any).lipidProcessor) {
        console.log('LipidProcessor: Eliminando instancia anterior para evitar duplicación');
      }
      
      // Registrar nuevas instancias
      (window as any).vitalSignsProcessor = this.processor;
      (window as any).glucoseProcessor = this.glucoseProcessor;
      (window as any).lipidProcessor = this.lipidProcessor;
      
      console.log('VitalSignsProcessor: Registrado globalmente con control de duplicación');
      console.log('GlucoseProcessor: Registrado globalmente con valores de configuración:', {
        MIN_SIGNAL_QUALITY: (this.glucoseProcessor as any).MIN_SIGNAL_QUALITY || 'N/A',
        BUFFER_SIZE: (this.glucoseProcessor as any).BUFFER_SIZE || 'N/A'
      });
      console.log('LipidProcessor: Registrado globalmente con valores de configuración:', {
        MIN_SIGNAL_QUALITY: (this.lipidProcessor as any).MIN_SIGNAL_QUALITY || 'N/A'
      });
    }
  }
  
  /**
   * Configura parámetros de alta sensibilidad en los procesadores
   */
  private configureEnhancedSensitivity(): void {
    // Aquí configuramos manualmente parámetros para mejorar sensibilidad
    console.log("VitalSignsProcessor: Configurando procesadores para EXTREMA sensibilidad en PRESIÓN, GLUCOSA Y LÍPIDOS");
    
    // Intentar acceder y modificar los parámetros internos para mayor sensibilidad
    if (this.processor && this.processor.signalProcessor) {
      // Reducir umbrales de calidad de señal aún más
      (this.processor.signalProcessor as any).MIN_SIGNAL_AMPLITUDE = 0.02; // Reducido considerablemente
      (this.processor.signalProcessor as any).MIN_SIGNAL_QUALITY = 15; // Reducido considerablemente
    }
    
    if (this.processor && this.processor.bpProcessor) {
      // Aumentar sensibilidad de presión extremadamente
      (this.processor.bpProcessor as any).MIN_SIGNAL_QUALITY = 0.2; // Reducido considerablemente
      (this.processor.bpProcessor as any).MIN_SAMPLES = 15; // Reducido considerablemente
      
      // Ajustes adicionales para mejorar detección de presión arterial
      (this.processor.bpProcessor as any).AMPLIFICATION_FACTOR = 1.4; // Aumentado para mejor detección
      (this.processor.bpProcessor as any).PEAK_THRESHOLD = 0.15; // Reducido para detectar más picos
      
      console.log("VitalSignsProcessor: Sensibilidad de detección de PRESIÓN aumentada a nivel EXTREMO");
    }
    
    if (this.processor && this.processor.spo2Processor) {
      // Aumentar sensibilidad SpO2 extremadamente
      (this.processor.spo2Processor as any).MIN_PERFUSION_INDEX = 0.015; // Reducido considerablemente
      (this.processor.spo2Processor as any).MIN_SIGNAL_QUALITY = 25; // Reducido considerablemente
    }
    
    // Configurar procesador de glucosa para sensibilidad EXTREMA
    if (this.glucoseProcessor) {
      (this.glucoseProcessor as any).MIN_SIGNAL_QUALITY = 20; // Reducido extremadamente
      
      // Ajustes adicionales para mejorar detección de glucosa
      if ((this.glucoseProcessor as any).BUFFER_SIZE) {
        (this.glucoseProcessor as any).BUFFER_SIZE = 4; // Reducido para respuesta casi inmediata
      }
      
      // NUEVO: Intentar configurar parámetro de calibración si existe
      if ((this.glucoseProcessor as any).CALIBRATION_OFFSET !== undefined) {
        (this.glucoseProcessor as any).CALIBRATION_OFFSET = 5; // Ajuste positivo para compensar
      }
      
      console.log("VitalSignsProcessor: Sensibilidad de detección de GLUCOSA aumentada a nivel EXTREMO");
    }
    
    // Configurar procesador de lípidos para sensibilidad EXTREMA
    if (this.lipidProcessor) {
      (this.lipidProcessor as any).MIN_SIGNAL_QUALITY = 15; // Reducido extremadamente
      
      // Ajustes adicionales para mejorar detección de lípidos
      if ((this.lipidProcessor as any).AMPLIFICATION_FACTOR) {
        (this.lipidProcessor as any).AMPLIFICATION_FACTOR = 1.5; // Aumentado considerablemente
      }
      
      console.log("VitalSignsProcessor: Sensibilidad de detección de LÍPIDOS aumentada a nivel EXTREMO");
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
        arrhythmiaStatus: "--",
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        }
      };
    }
    
    // Amplificar considerablemente los valores PPG para mejorar detección
    const amplifiedValue = ppgValue * 1.5; // Aumentado considerablemente
    
    // Obtener resultados básicos del procesador principal
    const baseResults = this.processor.processSignal(amplifiedValue, rrData);
    
    // Procesar glucosa manualmente si está disponible el procesador
    let glucose = 0;
    if (this.glucoseProcessor && typeof this.glucoseProcessor.calculateGlucose === 'function') {
      // Obtener datos PPG acumulados del procesador principal si están disponibles
      let ppgData = [];
      if (this.processor.signalProcessor && this.processor.signalProcessor.getPPGBuffer) {
        ppgData = this.processor.signalProcessor.getPPGBuffer();
      }
      
      // Si hay suficientes datos, procesar glucosa
      if (ppgData.length > 20) {
        try {
          glucose = this.glucoseProcessor.calculateGlucose(ppgData);
          console.log("VitalSignsProcessor: Glucosa calculada:", glucose);
        } catch (error) {
          console.error("Error calculando glucosa:", error);
        }
      }
    }
    
    // Procesar lípidos manualmente si está disponible el procesador
    let totalCholesterol = 0;
    let triglycerides = 0;
    if (this.lipidProcessor && typeof this.lipidProcessor.calculateLipids === 'function') {
      // Obtener datos PPG acumulados del procesador principal si están disponibles
      let ppgData = [];
      if (this.processor.signalProcessor && this.processor.signalProcessor.getPPGBuffer) {
        ppgData = this.processor.signalProcessor.getPPGBuffer();
      }
      
      // Si hay suficientes datos, procesar lípidos
      if (ppgData.length > 20) {
        try {
          const lipidResults = this.lipidProcessor.calculateLipids(ppgData);
          totalCholesterol = lipidResults.totalCholesterol;
          triglycerides = lipidResults.triglycerides;
          console.log("VitalSignsProcessor: Lípidos calculados:", { totalCholesterol, triglycerides });
        } catch (error) {
          console.error("Error calculando lípidos:", error);
        }
      }
    }
    
    // Combinar resultados para incluir glucosa y lípidos
    const enhancedResults = {
      ...baseResults,
      glucose: glucose,
      lipids: {
        totalCholesterol: totalCholesterol,
        triglycerides: triglycerides
      }
    };
    
    console.log("VitalSignsProcessor: Resultados completos:", enhancedResults);
    return enhancedResults;
  }
  
  /**
   * Reinicia todos los procesadores
   */
  public reset(): void {
    console.log("VitalSignsProcessor: Reiniciando todos los procesadores");
    this.processor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    
    // Reconfigurar después de reset para mantener alta sensibilidad
    this.configureEnhancedSensitivity();
  }
  
  /**
   * Método proxy para cálculo directo de presión arterial
   */
  public calculateBloodPressure(ppgValues: number[]): { systolic: number; diastolic: number } {
    // Validación muy permisiva de datos para permitir más mediciones
    if (!ppgValues || ppgValues.length < 20) { // Reducido al mínimo absoluto
      console.warn("VitalSignsProcessor: Datos insuficientes para calcular presión arterial", {
        longitud: ppgValues?.length || 0,
        requeridos: 20
      });
      return { systolic: 0, diastolic: 0 }; // Indicar medición inválida
    }
    
    // Amplificar valores considerablemente para mejor detección
    const amplifiedValues = ppgValues.map(val => val * 1.6); // Aumentado considerablemente
    const result = this.processor.calculateBloodPressure(amplifiedValues);
    
    // Verificar resultado y aplicar corrección si es necesario
    if (result.systolic === 0 || result.diastolic === 0) {
      console.log("VitalSignsProcessor: Intento de corrección de presión arterial con valores alternativos");
      // Intentar con otra amplificación como último recurso
      const alternativeValues = ppgValues.map(val => val * 2.0);
      const alternativeResult = this.processor.calculateBloodPressure(alternativeValues);
      return alternativeResult;
    }
    
    return result;
  }
  
  /**
   * Método proxy para cálculo directo de SpO2
   */
  public calculateSpO2(ppgValues: number[]): number {
    // Validación extremadamente permisiva de datos
    if (!ppgValues || ppgValues.length < 10) { // Reducido al mínimo absoluto
      console.warn("VitalSignsProcessor: Datos muy insuficientes para calcular SpO2", {
        longitud: ppgValues?.length || 0,
        requeridos: 10
      });
      return 0; // Indicar medición inválida
    }
    
    // Verificar disponibilidad del procesador y método
    if (this.processor.spo2Processor && typeof this.processor.spo2Processor.calculateSpO2 === 'function') {
      // Amplificar valores considerablemente para mejor detección
      const amplifiedValues = ppgValues.map(val => val * 1.4); // Aumentado considerablemente
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

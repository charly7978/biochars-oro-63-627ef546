/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Procesador avanzado de señales con múltiples técnicas
 * Combina filtros, ML y WebAssembly para procesamiento óptimo
 */

import { 
  createKalmanFilter, 
  KalmanFilter, 
  KalmanFilterConfig 
} from './filters/KalmanFilter';
import { 
  getWasmProcessor, 
  WasmProcessor 
} from './wasm/WasmProcessor';
import { 
  createSignalWorker, 
  SignalWorkerManager 
} from './workers/SignalWorker';
import { 
  createMLSignalProcessor, 
  MLSignalProcessor, 
  MLProcessorConfig 
} from './ml/MLSignalProcessor';

/**
 * Configuración del procesador avanzado
 */
export interface AdvancedProcessorConfig {
  // Habilitación de características
  enableWasm: boolean;
  enableWorkers: boolean;
  enableMLProcessing: boolean;
  enableAdaptiveKalman: boolean;
  enableAdaptiveSampling: boolean;
  
  // Configuración de componentes
  kalmanConfig?: Partial<KalmanFilterConfig>;
  mlConfig?: Partial<MLProcessorConfig>;
  
  // Parámetros de muestreo adaptativo
  minSamplingRate: number;
  maxSamplingRate: number;
  samplingAdaptationRate: number;
}

/**
 * Resultado del procesamiento avanzado
 */
export interface AdvancedProcessedSignal {
  timestamp: number;
  raw: number;
  filtered: number;
  enhanced: number;
  confidence: number;
  isPeak: boolean;
  peakConfidence?: number;
  processingTime: number;
  samplingRate: number;
  errorEstimate: number;
}

/**
 * Crea una instancia del procesador avanzado
 */
export const createAdvancedSignalProcessor = (
  config?: Partial<AdvancedProcessorConfig>
): AdvancedSignalProcessor => {
  return new AdvancedSignalProcessor(config);
};

/**
 * Clase para procesamiento avanzado de señal
 */
export class AdvancedSignalProcessor {
  // Componentes de procesamiento
  private kalmanFilter: KalmanFilter;
  private wasmProcessor: WasmProcessor;
  private workerManager: SignalWorkerManager;
  private mlProcessor: MLSignalProcessor;
  
  // Configuración
  private config: AdvancedProcessorConfig;
  
  // Estado
  private isInitialized: boolean = false;
  private signalBuffer: number[] = [];
  private readonly BUFFER_SIZE = 60;
  private lastProcessingTime: number = 0;
  private currentSamplingRate: number;
  private samplesCounter: number = 0;
  private lastSampleTime: number = 0;
  
  // Configuración por defecto optimizada
  private readonly DEFAULT_CONFIG: AdvancedProcessorConfig = {
    enableWasm: true,
    enableWorkers: true,
    enableMLProcessing: true,
    enableAdaptiveKalman: true,
    enableAdaptiveSampling: true,
    
    minSamplingRate: 5,
    maxSamplingRate: 30,
    samplingAdaptationRate: 0.2
  };
  
  /**
   * Constructor
   */
  constructor(config?: Partial<AdvancedProcessorConfig>) {
    // Inicializar configuración
    this.config = {
      ...this.DEFAULT_CONFIG,
      ...config
    };
    
    // Inicializar tasa de muestreo
    this.currentSamplingRate = this.config.maxSamplingRate;
    
    // Crear componentes
    this.kalmanFilter = createKalmanFilter({
      enableAdaptiveParameters: this.config.enableAdaptiveKalman,
      useWasmAcceleration: this.config.enableWasm,
      ...(this.config.kalmanConfig || {})
    });
    
    this.wasmProcessor = getWasmProcessor();
    this.workerManager = createSignalWorker();
    this.mlProcessor = createMLSignalProcessor(this.config.mlConfig);
    
    console.log("AdvancedSignalProcessor: Inicializado con configuración", {
      ...this.config,
      componentes: {
        kalman: "creado",
        wasm: "obtenido",
        worker: "creado",
        ml: "creado"
      }
    });
    
    // Inicializar en segundo plano
    this.initialize();
  }
  
  /**
   * Inicializa todos los componentes en segundo plano
   */
  private async initialize(): Promise<void> {
    try {
      console.log("AdvancedSignalProcessor: Iniciando inicialización de componentes");
      const startTime = Date.now();
      
      // Inicializar componentes en paralelo
      const initPromises: Promise<any>[] = [];
      
      // Inicializar WASM si está habilitado
      if (this.config.enableWasm) {
        initPromises.push(this.wasmProcessor.initialize());
      }
      
      // Inicializar Worker si está habilitado
      if (this.config.enableWorkers) {
        initPromises.push(this.workerManager.initialize());
      }
      
      // Inicializar ML si está habilitado
      if (this.config.enableMLProcessing) {
        initPromises.push(this.mlProcessor.initialize());
      }
      
      // Esperar a que todo se inicialice
      await Promise.all(initPromises);
      
      this.isInitialized = true;
      
      console.log(`AdvancedSignalProcessor: Inicialización completada en ${Date.now() - startTime}ms`);
    } catch (error) {
      console.error("AdvancedSignalProcessor: Error durante la inicialización", error);
    }
  }
  
  /**
   * Procesa un valor de señal utilizando la configuración actual
   */
  public processValue(value: number): AdvancedProcessedSignal {
    const startTime = Date.now();
    
    // Muestreo adaptativo
    if (this.config.enableAdaptiveSampling) {
      if (!this.shouldProcessSample()) {
        // Si no debemos procesar esta muestra según la tasa adaptativa,
        // devolver el último resultado calculado
        return this.createResultWithLastValues(value);
      }
    }
    
    // Almacenar valor original en buffer
    this.signalBuffer.push(value);
    if (this.signalBuffer.length > this.BUFFER_SIZE) {
      this.signalBuffer.shift();
    }
    
    // Si no está inicializado, devolver valor filtrado básico
    if (!this.isInitialized) {
      const filtered = this.kalmanFilter.filter(value);
      
      // Actualizar tasa de muestreo
      this.updateSamplingRate(0.8); // Alta calidad hasta inicialización completa
      
      // Registrar tiempo de procesamiento
      this.lastProcessingTime = Date.now() - startTime;
      
      return {
        timestamp: Date.now(),
        raw: value,
        filtered,
        enhanced: filtered,
        confidence: 0.6,
        isPeak: false,
        processingTime: this.lastProcessingTime,
        samplingRate: this.currentSamplingRate,
        errorEstimate: 0.2
      };
    }
    
    // Procesar con Kalman
    let filtered = this.kalmanFilter.filter(value);
    
    // Variable para valor mejorado
    let enhanced = filtered;
    let quality = 0.7;
    let confidence = 0.7;
    
    // Procesar con ML si está disponible y habilitado
    if (this.config.enableMLProcessing && this.signalBuffer.length >= 30) {
      try {
        // Procesar con ML asíncronamente (no esperamos el resultado)
        this.processWithML(filtered).then(mlResult => {
          // El resultado se aplicará en el próximo frame
          if (mlResult && mlResult.confidence > 0.6) {
            enhanced = mlResult.enhanced;
            quality = mlResult.quality;
            confidence = mlResult.confidence;
            
            // Adaptar tasa de muestreo basada en calidad
            this.updateSamplingRate(quality);
          }
        }).catch(error => {
          console.error("Error en procesamiento ML:", error);
        });
      } catch (error) {
        console.error("AdvancedSignalProcessor: Error al procesar con ML", error);
      }
    }
    
    // Calcular estimación de error basada en covarianza Kalman
    const kalmanState = this.kalmanFilter.getState();
    const errorEstimate = Math.sqrt(kalmanState.covariance);
    
    // Registrar tiempo de procesamiento
    this.lastProcessingTime = Date.now() - startTime;
    
    // Crear resultado
    return {
      timestamp: Date.now(),
      raw: value,
      filtered,
      enhanced,
      confidence,
      isPeak: false,
      processingTime: this.lastProcessingTime,
      samplingRate: this.currentSamplingRate,
      errorEstimate
    };
  }
  
  /**
   * Decide si procesar una muestra según tasa adaptativa
   */
  private shouldProcessSample(): boolean {
    const now = Date.now();
    
    // Primera muestra o después de reinicio
    if (this.lastSampleTime === 0) {
      this.lastSampleTime = now;
      return true;
    }
    
    // Calcular tiempo transcurrido desde última muestra procesada
    const elapsed = now - this.lastSampleTime;
    const sampleInterval = 1000 / this.currentSamplingRate;
    
    // Procesar si el tiempo transcurrido supera el intervalo de muestreo
    if (elapsed >= sampleInterval) {
      this.lastSampleTime = now;
      this.samplesCounter++;
      return true;
    }
    
    return false;
  }
  
  /**
   * Crea un resultado con los últimos valores calculados
   */
  private createResultWithLastValues(newValue: number): AdvancedProcessedSignal {
    return {
      timestamp: Date.now(),
      raw: newValue,
      filtered: newValue, // Sin filtrado para muestras no procesadas
      enhanced: newValue, // Sin mejora para muestras no procesadas
      confidence: 0.5, // Calidad reducida para muestras interpoladas
      isPeak: false,
      processingTime: 0, // No hubo procesamiento real
      samplingRate: this.currentSamplingRate,
      errorEstimate: 0.3
    };
  }
  
  /**
   * Actualiza la tasa de muestreo adaptativa
   */
  private updateSamplingRate(quality: number): void {
    // Solo actualizar si el muestreo adaptativo está habilitado
    if (!this.config.enableAdaptiveSampling) return;
    
    // Calcular nueva tasa de muestreo basada en calidad
    // Alta calidad -> Tasa más baja (ahorro de recursos)
    // Baja calidad -> Tasa más alta (mayor precisión)
    const targetRate = quality > 0.8
      ? this.config.minSamplingRate
      : quality < 0.4
        ? this.config.maxSamplingRate
        : this.config.minSamplingRate + 
          (1 - quality) * (this.config.maxSamplingRate - this.config.minSamplingRate);
    
    // Actualizar con suavizado exponencial
    this.currentSamplingRate = 
      (1 - this.config.samplingAdaptationRate) * this.currentSamplingRate + 
      this.config.samplingAdaptationRate * targetRate;
    
    // Asegurar que esté dentro de límites
    this.currentSamplingRate = Math.max(
      this.config.minSamplingRate,
      Math.min(this.config.maxSamplingRate, this.currentSamplingRate)
    );
  }
  
  /**
   * Procesa un valor con el procesador ML
   */
  private async processWithML(value: number): Promise<MLProcessedSignal | null> {
    try {
      return this.mlProcessor.processValue(value);
    } catch (error) {
      console.error("AdvancedSignalProcessor: Error en procesamiento ML", error);
      return null;
    }
  }
  
  /**
   * Configura el procesador con nuevas opciones
   */
  public configure(config: Partial<AdvancedProcessorConfig>): void {
    // Actualizar configuración principal
    this.config = {
      ...this.config,
      ...config
    };
    
    // Actualizar componentes
    if (config.kalmanConfig) {
      this.kalmanFilter.updateConfig({
        ...config.kalmanConfig,
        enableAdaptiveParameters: this.config.enableAdaptiveKalman,
        useWasmAcceleration: this.config.enableWasm
      });
    }
    
    if (config.mlConfig) {
      this.mlProcessor.configure({
        ...config.mlConfig,
        enableMLProcessing: this.config.enableMLProcessing
      });
    }
    
    console.log("AdvancedSignalProcessor: Configuración actualizada", this.config);
  }
  
  /**
   * Reinicia el procesador y todos sus componentes
   */
  public reset(): void {
    this.signalBuffer = [];
    this.samplesCounter = 0;
    this.lastSampleTime = 0;
    this.currentSamplingRate = this.config.maxSamplingRate;
    
    // Reiniciar componentes
    this.kalmanFilter.reset();
    this.mlProcessor.reset();
    
    console.log("AdvancedSignalProcessor: Reset completo");
  }
  
  /**
   * Libera todos los recursos
   */
  public dispose(): void {
    this.reset();
    this.mlProcessor.dispose();
    this.workerManager.dispose();
    
    this.isInitialized = false;
    
    console.log("AdvancedSignalProcessor: Recursos liberados");
  }
}

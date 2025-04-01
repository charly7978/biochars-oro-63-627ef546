
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Extractor combinado que integra la extracción de latidos y señal PPG
 * Proporciona una salida unificada con todos los datos extraídos
 * Mejorado con procesamiento avanzado: WASM, Web Worker, ML, Kalman
 */
import { 
  HeartbeatExtractor, 
  HeartbeatExtractionResult, 
  createHeartbeatExtractor 
} from './HeartbeatExtractor';
import { 
  PPGSignalExtractor, 
  PPGSignalExtractionResult,
  createPPGSignalExtractor
} from './PPGSignalExtractor';
import {
  createAdvancedSignalProcessor,
  AdvancedSignalProcessor,
  AdvancedProcessedSignal
} from './AdvancedSignalProcessor';

// Resultado combinado con datos de ambos extractores
export interface CombinedExtractionResult {
  // Datos básicos
  timestamp: number;
  rawValue: number;
  filteredValue: number;
  
  // Información de señal
  quality: number;
  fingerDetected: boolean;
  amplitude: number;
  baseline: number;
  
  // Información de latidos
  hasPeak: boolean;
  peakTime: number | null;
  peakValue: number | null;
  confidence: number;
  instantaneousBPM: number | null;
  rrInterval: number | null;
  
  // Estadísticas calculadas
  averageBPM: number | null;
  heartRateVariability: number | null;
  
  // Campos avanzados: ML enhancement y aceleración
  mlEnhanced: boolean;
  mlConfidence: number;
  enhancedValue: number;
  
  // Nuevos campos: información de rendimiento
  processingTime: number;
  samplingRate: number;
  errorEstimate: number;
}

/**
 * Opciones de configuración
 */
export interface CombinedExtractorConfig {
  enableAdvancedProcessing: boolean;
  enableWasm: boolean;
  enableWorkers: boolean;
  enableML: boolean;
  enableAdaptiveKalman: boolean;
  enableAdaptiveSampling: boolean;
}

/**
 * Clase para extracción combinada de datos PPG y latidos
 * Mejorada con procesamiento avanzado: WASM, Web Worker, ML, Kalman
 */
export class CombinedExtractor {
  private ppgExtractor: PPGSignalExtractor;
  private heartbeatExtractor: HeartbeatExtractor;
  private advancedProcessor: AdvancedSignalProcessor;
  
  // Configuración avanzada
  private config: CombinedExtractorConfig;
  private advancedProcessingInitialized: boolean = false;
  private processingConfidenceThreshold: number = 0.6;
  
  // Valores por defecto
  private readonly DEFAULT_CONFIG: CombinedExtractorConfig = {
    enableAdvancedProcessing: true,
    enableWasm: true,
    enableWorkers: true,
    enableML: true,
    enableAdaptiveKalman: true,
    enableAdaptiveSampling: true
  };
  
  constructor(config?: Partial<CombinedExtractorConfig>) {
    // Inicializar configuración
    this.config = {
      ...this.DEFAULT_CONFIG,
      ...config
    };
    
    // Crear extractores básicos
    this.ppgExtractor = createPPGSignalExtractor();
    this.heartbeatExtractor = createHeartbeatExtractor();
    
    // Inicializar procesador avanzado si está habilitado
    if (this.config.enableAdvancedProcessing) {
      try {
        console.log("CombinedExtractor: Inicializando procesador avanzado");
        this.advancedProcessor = createAdvancedSignalProcessor({
          enableWasm: this.config.enableWasm,
          enableWorkers: this.config.enableWorkers, 
          enableMLProcessing: this.config.enableML,
          enableAdaptiveKalman: this.config.enableAdaptiveKalman,
          enableAdaptiveSampling: this.config.enableAdaptiveSampling
        });
        this.advancedProcessingInitialized = true;
      } catch (error) {
        console.error("CombinedExtractor: Error inicializando procesador avanzado, continuando sin él", error);
        this.advancedProcessingInitialized = false;
      }
    }
  }
  
  /**
   * Procesa un valor PPG y extrae toda la información disponible
   * Ahora con mejora avanzada: WASM, Web Worker, ML, Kalman
   * @param value Valor PPG sin procesar
   * @returns Resultado combinado con todos los datos extraídos
   */
  public processValue(value: number): CombinedExtractionResult {
    // Primero procesar la señal PPG
    const ppgResult = this.ppgExtractor.processValue(value);
    
    // Procesar con avanzado si está habilitado
    let advancedResult: AdvancedProcessedSignal | null = null;
    if (this.config.enableAdvancedProcessing && this.advancedProcessingInitialized) {
      advancedResult = this.advancedProcessor.processValue(ppgResult.filteredValue);
    }
    
    // Usar valor mejorado si hay suficiente confianza, sino usar filtrado normal
    const valueToProcess = (advancedResult && advancedResult.confidence >= this.processingConfidenceThreshold) 
      ? advancedResult.enhanced 
      : ppgResult.filteredValue;
    
    // Luego extraer información de latidos del valor procesado
    const heartbeatResult = this.heartbeatExtractor.processValue(valueToProcess);
    
    // Combinar resultados
    return {
      // Datos básicos
      timestamp: ppgResult.timestamp,
      rawValue: ppgResult.rawValue,
      filteredValue: ppgResult.filteredValue,
      
      // Información de señal
      quality: ppgResult.quality,
      fingerDetected: ppgResult.fingerDetected,
      amplitude: ppgResult.amplitude,
      baseline: ppgResult.baseline,
      
      // Información de latidos
      hasPeak: heartbeatResult.hasPeak,
      peakTime: heartbeatResult.peakTime,
      peakValue: heartbeatResult.hasPeak ? heartbeatResult.peakValue : null,
      confidence: heartbeatResult.confidence,
      instantaneousBPM: heartbeatResult.instantaneousBPM,
      rrInterval: heartbeatResult.rrInterval,
      
      // Estadísticas calculadas
      averageBPM: this.heartbeatExtractor.getAverageBPM(),
      heartRateVariability: this.heartbeatExtractor.getHeartRateVariability(),
      
      // Campos avanzados: ML enhancement
      mlEnhanced: !!(advancedResult && advancedResult.confidence >= this.processingConfidenceThreshold),
      mlConfidence: advancedResult ? advancedResult.confidence : 0,
      enhancedValue: advancedResult ? advancedResult.enhanced : ppgResult.filteredValue,
      
      // Información de rendimiento
      processingTime: advancedResult ? advancedResult.processingTime : 0,
      samplingRate: advancedResult ? advancedResult.samplingRate : 30,
      errorEstimate: advancedResult ? advancedResult.errorEstimate : 0.2
    };
  }
  
  /**
   * Configura el procesamiento avanzado
   */
  public configureAdvancedProcessing(config: Partial<CombinedExtractorConfig>, confidenceThreshold?: number): void {
    // Actualizar configuración
    this.config = {
      ...this.config,
      ...config
    };
    
    if (confidenceThreshold !== undefined) {
      this.processingConfidenceThreshold = Math.max(0, Math.min(1, confidenceThreshold));
    }
    
    // Actualizar configuración del procesador si existe
    if (this.advancedProcessingInitialized && this.advancedProcessor) {
      this.advancedProcessor.configure({
        enableWasm: this.config.enableWasm,
        enableWorkers: this.config.enableWorkers,
        enableMLProcessing: this.config.enableML,
        enableAdaptiveKalman: this.config.enableAdaptiveKalman,
        enableAdaptiveSampling: this.config.enableAdaptiveSampling
      });
    }
    // Si estamos habilitando procesamiento avanzado y no existe, crearlo
    else if (this.config.enableAdvancedProcessing && !this.advancedProcessor) {
      try {
        this.advancedProcessor = createAdvancedSignalProcessor({
          enableWasm: this.config.enableWasm,
          enableWorkers: this.config.enableWorkers,
          enableMLProcessing: this.config.enableML,
          enableAdaptiveKalman: this.config.enableAdaptiveKalman,
          enableAdaptiveSampling: this.config.enableAdaptiveSampling
        });
        this.advancedProcessingInitialized = true;
      } catch (error) {
        console.error("CombinedExtractor: Error iniciando procesador avanzado", error);
      }
    }
    
    console.log("CombinedExtractor: Procesamiento avanzado configurado", {
      habilitado: this.config.enableAdvancedProcessing,
      umbralConfianza: this.processingConfidenceThreshold,
      wasm: this.config.enableWasm,
      workers: this.config.enableWorkers,
      ml: this.config.enableML
    });
  }
  
  /**
   * Obtiene el extractor de señal PPG interno
   */
  public getPPGExtractor(): PPGSignalExtractor {
    return this.ppgExtractor;
  }
  
  /**
   * Obtiene el extractor de latidos interno
   */
  public getHeartbeatExtractor(): HeartbeatExtractor {
    return this.heartbeatExtractor;
  }
  
  /**
   * Obtiene el procesador avanzado si está disponible
   */
  public getAdvancedProcessor(): AdvancedSignalProcessor | null {
    return this.advancedProcessingInitialized ? this.advancedProcessor : null;
  }
  
  /**
   * Reinicia todos los extractores
   */
  public reset(): void {
    this.ppgExtractor.reset();
    this.heartbeatExtractor.reset();
    
    if (this.advancedProcessingInitialized && this.advancedProcessor) {
      this.advancedProcessor.reset();
    }
  }
  
  /**
   * Libera todos los recursos
   */
  public dispose(): void {
    this.reset();
    
    if (this.advancedProcessingInitialized && this.advancedProcessor) {
      this.advancedProcessor.dispose();
      this.advancedProcessingInitialized = false;
    }
  }
}

/**
 * Crea una instancia de extractor combinado
 */
export const createCombinedExtractor = (
  config?: Partial<CombinedExtractorConfig>
): CombinedExtractor => {
  return new CombinedExtractor(config);
};

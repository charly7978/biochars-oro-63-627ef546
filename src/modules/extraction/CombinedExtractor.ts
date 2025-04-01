
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Extractor combinado que integra la extracción de latidos y señal PPG
 * Proporciona una salida unificada con todos los datos extraídos
 * Mejorado con procesamiento ML de precisión mixta
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
  MLSignalProcessor,
  createMLSignalProcessor,
  MLProcessedSignal
} from './ml';

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
  
  // Nuevos campos: ML enhancement
  mlEnhanced: boolean;
  mlConfidence: number;
  enhancedValue: number;
}

/**
 * Clase para extracción combinada de datos PPG y latidos
 * Mejorada con procesamiento ML de precisión mixta
 */
export class CombinedExtractor {
  private ppgExtractor: PPGSignalExtractor;
  private heartbeatExtractor: HeartbeatExtractor;
  private mlProcessor: MLSignalProcessor | null = null;
  
  // Configuración de ML
  private enableMLProcessing: boolean = true;
  private mlProcessorInitialized: boolean = false;
  private mlConfidenceThreshold: number = 0.6;
  
  constructor(enableMLProcessing: boolean = true) {
    this.ppgExtractor = createPPGSignalExtractor();
    this.heartbeatExtractor = createHeartbeatExtractor();
    this.enableMLProcessing = enableMLProcessing;
    
    // Inicializar ML processor si está habilitado
    if (this.enableMLProcessing) {
      try {
        console.log("CombinedExtractor: Inicializando procesador ML");
        this.mlProcessor = createMLSignalProcessor({
          enableMLProcessing: true,
          windowSize: 30,
          minBufferSize: 45
        });
        this.mlProcessorInitialized = true;
      } catch (error) {
        console.error("CombinedExtractor: Error inicializando procesador ML, continuando sin ML", error);
        this.mlProcessorInitialized = false;
      }
    }
  }
  
  /**
   * Procesa un valor PPG y extrae toda la información disponible
   * Ahora con mejora opcional de ML
   * @param value Valor PPG sin procesar
   * @returns Resultado combinado con todos los datos extraídos
   */
  public processValue(value: number): CombinedExtractionResult {
    // Primero procesar la señal PPG
    const ppgResult = this.ppgExtractor.processValue(value);
    
    // Procesar con ML si está habilitado
    let mlResult: MLProcessedSignal | null = null;
    if (this.enableMLProcessing && this.mlProcessorInitialized && this.mlProcessor) {
      mlResult = this.mlProcessor.processValue(ppgResult.filteredValue);
    }
    
    // Usar valor mejorado por ML si hay suficiente confianza, sino usar filtrado normal
    const valueToProcess = (mlResult && mlResult.confidence >= this.mlConfidenceThreshold) 
      ? mlResult.enhanced 
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
      
      // Nuevos campos: ML enhancement
      mlEnhanced: !!(mlResult && mlResult.confidence >= this.mlConfidenceThreshold),
      mlConfidence: mlResult ? mlResult.confidence : 0,
      enhancedValue: mlResult ? mlResult.enhanced : ppgResult.filteredValue
    };
  }
  
  /**
   * Configura el procesamiento ML
   */
  public configureMLProcessing(enable: boolean, confidenceThreshold?: number): void {
    this.enableMLProcessing = enable;
    
    if (confidenceThreshold !== undefined) {
      this.mlConfidenceThreshold = Math.max(0, Math.min(1, confidenceThreshold));
    }
    
    // Si estamos habilitando ML y no existe el procesador, crearlo
    if (this.enableMLProcessing && !this.mlProcessor) {
      try {
        this.mlProcessor = createMLSignalProcessor();
        this.mlProcessorInitialized = true;
      } catch (error) {
        console.error("CombinedExtractor: Error iniciando procesador ML", error);
      }
    }
    
    console.log("CombinedExtractor: ML procesamiento configurado", {
      habilitado: this.enableMLProcessing,
      umbralConfianza: this.mlConfidenceThreshold
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
   * Obtiene el procesador ML si está disponible
   */
  public getMLProcessor(): MLSignalProcessor | null {
    return this.mlProcessor;
  }
  
  /**
   * Reinicia todos los extractores
   */
  public reset(): void {
    this.ppgExtractor.reset();
    this.heartbeatExtractor.reset();
    
    if (this.mlProcessor) {
      this.mlProcessor.reset();
    }
  }
  
  /**
   * Libera todos los recursos
   */
  public dispose(): void {
    this.reset();
    
    if (this.mlProcessor) {
      this.mlProcessor.dispose();
      this.mlProcessor = null;
      this.mlProcessorInitialized = false;
    }
  }
}

/**
 * Crea una instancia de extractor combinado
 */
export const createCombinedExtractor = (enableMLProcessing: boolean = true): CombinedExtractor => {
  return new CombinedExtractor(enableMLProcessing);
};

/**
 * Procesa un valor PPG con un extractor combinado
 * (Función de utilidad para uso directo)
 */
export const extractCombinedData = (
  value: number, 
  extractor: CombinedExtractor
): CombinedExtractionResult => {
  return extractor.processValue(value);
};


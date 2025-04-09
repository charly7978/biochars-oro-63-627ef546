
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Extractor combinado que integra la extracción de latidos y señal PPG
 * Proporciona una salida unificada con todos los datos extraídos
 * Versión mejorada con tecnología TensorFlow y procesamiento avanzado
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
  AdvancedPPGExtractor,
  AdvancedExtractionResult,
  createAdvancedPPGExtractor,
  AdvancedExtractorConfig
} from './AdvancedPPGExtractor';

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
}

/**
 * Opciones para la inicialización del extractor combinado
 */
export interface CombinedExtractorOptions {
  useAdvancedExtractor: boolean;
  advancedConfig?: Partial<AdvancedExtractorConfig>;
}

/**
 * Clase para extracción combinada de datos PPG y latidos
 * Versión mejorada con procesamiento avanzado de señales
 */
export class CombinedExtractor {
  private ppgExtractor: PPGSignalExtractor;
  private heartbeatExtractor: HeartbeatExtractor;
  private advancedExtractor: AdvancedPPGExtractor | null = null;
  private useAdvanced: boolean;
  
  constructor(options?: CombinedExtractorOptions) {
    // Default to using advanced extractor
    this.useAdvanced = options?.useAdvancedExtractor !== false;
    
    // Create regular extractors
    this.ppgExtractor = createPPGSignalExtractor();
    this.heartbeatExtractor = createHeartbeatExtractor();
    
    // Create advanced extractor if enabled
    if (this.useAdvanced) {
      console.log("CombinedExtractor: Creating advanced extractor with TensorFlow");
      this.advancedExtractor = createAdvancedPPGExtractor(options?.advancedConfig);
    }
    
    console.log(`CombinedExtractor initialized. Using advanced extractor: ${this.useAdvanced}`);
  }
  
  /**
   * Procesa un valor PPG y extrae toda la información disponible
   * Utiliza el extractor avanzado si está habilitado
   * @param value Valor PPG sin procesar
   * @returns Resultado combinado con todos los datos extraídos
   */
  public processValue(value: number): CombinedExtractionResult {
    // Usar extractor avanzado si está disponible
    if (this.useAdvanced && this.advancedExtractor) {
      return this.advancedExtractor.processValue(value);
    }
    
    // Fallback a procesamiento clásico
    // Primero procesar la señal PPG
    const ppgResult = this.ppgExtractor.processValue(value);
    
    // Luego extraer información de latidos del valor filtrado
    const heartbeatResult = this.heartbeatExtractor.processValue(ppgResult.filteredValue);
    
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
      heartRateVariability: this.heartbeatExtractor.getHeartRateVariability()
    };
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
   * Obtiene el extractor avanzado si está disponible
   */
  public getAdvancedExtractor(): AdvancedPPGExtractor | null {
    return this.advancedExtractor;
  }
  
  /**
   * Indica si se está utilizando el extractor avanzado
   */
  public isUsingAdvancedExtractor(): boolean {
    return this.useAdvanced && this.advancedExtractor !== null;
  }
  
  /**
   * Activa o desactiva el extractor avanzado
   */
  public setUseAdvancedExtractor(useAdvanced: boolean): void {
    if (useAdvanced === this.useAdvanced) return;
    
    this.useAdvanced = useAdvanced;
    
    // Crear el extractor avanzado si se activa y no existe
    if (useAdvanced && !this.advancedExtractor) {
      this.advancedExtractor = createAdvancedPPGExtractor();
    }
    
    console.log(`CombinedExtractor: Advanced extractor ${useAdvanced ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Reinicia todos los extractores
   */
  public reset(): void {
    this.ppgExtractor.reset();
    this.heartbeatExtractor.reset();
    
    if (this.advancedExtractor) {
      this.advancedExtractor.reset();
    }
    
    console.log("CombinedExtractor: All extractors reset");
  }
}

/**
 * Crea una instancia de extractor combinado
 */
export const createCombinedExtractor = (options?: CombinedExtractorOptions): CombinedExtractor => {
  return new CombinedExtractor(options);
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

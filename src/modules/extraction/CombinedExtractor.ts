
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Extractor combinado que integra la extracción de latidos y señal PPG
 * Proporciona una salida unificada con todos los datos extraídos
 * Versión mejorada con tecnología TensorFlow y procesamiento avanzado
 * Ahora con sistema de priorización de datos y canal de diagnóstico
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

// Enum para niveles de prioridad del procesamiento
export enum ProcessingPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

// Interfaz para datos de diagnóstico
export interface DiagnosticsEntry {
  timestamp: number;
  extractorType: 'combined' | 'ppg' | 'heartbeat' | 'advanced';
  processingTime: number;
  inputAmplitude: number;
  priority: ProcessingPriority;
  memoryUsage?: number;
  queueLength?: number;
}

// Resultado combinado con datos de ambos extractores
// Ahora incluye información de prioridad
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
  
  // Sistema de priorización de datos
  priority: ProcessingPriority;
}

/**
 * Opciones para la inicialización del extractor combinado
 */
export interface CombinedExtractorOptions {
  useAdvancedExtractor: boolean;
  advancedConfig?: Partial<AdvancedExtractorConfig>;
  enableDiagnostics?: boolean;
  prioritizationThresholds?: {
    highPriorityConfidence: number;
    mediumPriorityConfidence: number;
  };
}

/**
 * Clase para extracción combinada de datos PPG y latidos
 * Versión mejorada con procesamiento avanzado de señales
 * Ahora implementa sistema de priorización y diagnóstico
 */
export class CombinedExtractor {
  private ppgExtractor: PPGSignalExtractor;
  private heartbeatExtractor: HeartbeatExtractor;
  private advancedExtractor: AdvancedPPGExtractor | null = null;
  private useAdvanced: boolean;
  
  // Nuevas propiedades para diagnóstico y priorización
  private diagnosticsBuffer: DiagnosticsEntry[] = [];
  private readonly maxDiagnosticsEntries: number = 100;
  private enableDiagnostics: boolean;
  
  // Configuración de umbrales de priorización
  private highPriorityConfidence: number;
  private mediumPriorityConfidence: number;
  
  constructor(options?: CombinedExtractorOptions) {
    // Default to using advanced extractor
    this.useAdvanced = options?.useAdvancedExtractor !== false;
    
    // Configurar diagnóstico
    this.enableDiagnostics = options?.enableDiagnostics !== false;
    
    // Configurar umbrales de priorización
    this.highPriorityConfidence = options?.prioritizationThresholds?.highPriorityConfidence || 0.7;
    this.mediumPriorityConfidence = options?.prioritizationThresholds?.mediumPriorityConfidence || 0.4;
    
    // Create regular extractors
    this.ppgExtractor = createPPGSignalExtractor();
    this.heartbeatExtractor = createHeartbeatExtractor();
    
    // Create advanced extractor if enabled
    if (this.useAdvanced) {
      console.log("CombinedExtractor: Creating advanced extractor with TensorFlow");
      this.advancedExtractor = createAdvancedPPGExtractor(options?.advancedConfig);
    }
    
    console.log(`CombinedExtractor initialized. Using advanced extractor: ${this.useAdvanced}`);
    console.log(`CombinedExtractor: Diagnostics enabled: ${this.enableDiagnostics}`);
    console.log(`CombinedExtractor: Prioritization thresholds - High: ${this.highPriorityConfidence}, Medium: ${this.mediumPriorityConfidence}`);
  }
  
  /**
   * Determina la prioridad de procesamiento basada en la calidad de la señal
   * @param confidence Nivel de confianza del análisis
   * @param amplitude Amplitud de la señal
   * @returns Nivel de prioridad para el procesamiento
   */
  private determinePriority(confidence: number, amplitude: number): ProcessingPriority {
    // Prioridad basada principalmente en la confianza
    if (confidence >= this.highPriorityConfidence) {
      return ProcessingPriority.HIGH;
    } else if (confidence >= this.mediumPriorityConfidence) {
      return ProcessingPriority.MEDIUM;
    }
    
    // Si la confianza es baja pero la amplitud es alta, podría ser un evento importante
    if (amplitude > 0.3) {
      return ProcessingPriority.MEDIUM;
    }
    
    return ProcessingPriority.LOW;
  }
  
  /**
   * Registra una entrada en el buffer de diagnóstico
   */
  private logDiagnostics(entry: DiagnosticsEntry): void {
    if (!this.enableDiagnostics) return;
    
    this.diagnosticsBuffer.push(entry);
    if (this.diagnosticsBuffer.length > this.maxDiagnosticsEntries) {
      this.diagnosticsBuffer.shift();
    }
  }
  
  /**
   * Procesa un valor PPG y extrae toda la información disponible
   * Utiliza el extractor avanzado si está habilitado
   * Implementa priorización de datos
   * @param value Valor PPG sin procesar
   * @returns Resultado combinado con todos los datos extraídos
   */
  public processValue(value: number): CombinedExtractionResult {
    const startTime = performance.now();
    
    // Usar extractor avanzado si está disponible
    if (this.useAdvanced && this.advancedExtractor) {
      const result = this.advancedExtractor.processValue(value);
      
      // Determinar prioridad basada en la confianza y amplitud
      const priority = this.determinePriority(
        result.confidence,
        result.amplitude
      );
      
      // Registrar diagnóstico
      if (this.enableDiagnostics) {
        this.logDiagnostics({
          timestamp: Date.now(),
          extractorType: 'advanced',
          processingTime: performance.now() - startTime,
          inputAmplitude: Math.abs(value),
          priority,
          memoryUsage: this.estimateMemoryUsage()
        });
      }
      
      // Agregar información de prioridad al resultado
      return {
        ...result,
        priority
      };
    }
    
    // Fallback a procesamiento clásico
    // Primero procesar la señal PPG
    const ppgStartTime = performance.now();
    const ppgResult = this.ppgExtractor.processValue(value);
    const ppgProcessingTime = performance.now() - ppgStartTime;
    
    // Luego extraer información de latidos del valor filtrado
    const heartbeatStartTime = performance.now();
    const heartbeatResult = this.heartbeatExtractor.processValue(ppgResult.filteredValue);
    const heartbeatProcessingTime = performance.now() - heartbeatStartTime;
    
    // Determinar prioridad del procesamiento
    const priority = this.determinePriority(
      heartbeatResult.confidence,
      ppgResult.amplitude
    );
    
    // Registrar diagnósticos para cada extractor
    if (this.enableDiagnostics) {
      this.logDiagnostics({
        timestamp: Date.now(),
        extractorType: 'ppg',
        processingTime: ppgProcessingTime,
        inputAmplitude: Math.abs(value),
        priority: priority
      });
      
      this.logDiagnostics({
        timestamp: Date.now(),
        extractorType: 'heartbeat',
        processingTime: heartbeatProcessingTime,
        inputAmplitude: Math.abs(ppgResult.filteredValue),
        priority: priority
      });
      
      this.logDiagnostics({
        timestamp: Date.now(),
        extractorType: 'combined',
        processingTime: performance.now() - startTime,
        inputAmplitude: Math.abs(value),
        priority: priority,
        memoryUsage: this.estimateMemoryUsage(),
        queueLength: this.diagnosticsBuffer.length
      });
    }
    
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
      
      // Priorización
      priority
    };
  }
  
  /**
   * Estima el uso aproximado de memoria
   * Método simplificado para diagnóstico
   */
  private estimateMemoryUsage(): number {
    return this.diagnosticsBuffer.length * 200; // estimación aproximada en bytes
  }
  
  /**
   * Obtiene todos los datos de diagnóstico recolectados
   */
  public getDiagnosticsData(): DiagnosticsEntry[] {
    return [...this.diagnosticsBuffer];
  }
  
  /**
   * Limpia el buffer de diagnóstico
   */
  public clearDiagnostics(): void {
    this.diagnosticsBuffer = [];
  }
  
  /**
   * Obtiene estadísticas de rendimiento basadas en datos de diagnóstico
   */
  public getPerformanceMetrics(): {
    avgProcessingTime: number;
    highPriorityPercentage: number;
    mediumPriorityPercentage: number;
    lowPriorityPercentage: number;
    avgMemoryUsage: number;
  } {
    if (this.diagnosticsBuffer.length === 0) {
      return {
        avgProcessingTime: 0,
        highPriorityPercentage: 0,
        mediumPriorityPercentage: 0,
        lowPriorityPercentage: 0,
        avgMemoryUsage: 0
      };
    }
    
    const totalTime = this.diagnosticsBuffer.reduce((sum, entry) => sum + entry.processingTime, 0);
    const highPriorityCount = this.diagnosticsBuffer.filter(entry => entry.priority === ProcessingPriority.HIGH).length;
    const mediumPriorityCount = this.diagnosticsBuffer.filter(entry => entry.priority === ProcessingPriority.MEDIUM).length;
    const lowPriorityCount = this.diagnosticsBuffer.filter(entry => entry.priority === ProcessingPriority.LOW).length;
    
    const memoryEntries = this.diagnosticsBuffer.filter(entry => entry.memoryUsage !== undefined);
    const totalMemory = memoryEntries.reduce((sum, entry) => sum + (entry.memoryUsage || 0), 0);
    
    return {
      avgProcessingTime: totalTime / this.diagnosticsBuffer.length,
      highPriorityPercentage: (highPriorityCount / this.diagnosticsBuffer.length) * 100,
      mediumPriorityPercentage: (mediumPriorityCount / this.diagnosticsBuffer.length) * 100,
      lowPriorityPercentage: (lowPriorityCount / this.diagnosticsBuffer.length) * 100,
      avgMemoryUsage: memoryEntries.length > 0 ? totalMemory / memoryEntries.length : 0
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
   * Activa o desactiva el sistema de diagnóstico
   */
  public setDiagnosticsEnabled(enabled: boolean): void {
    this.enableDiagnostics = enabled;
    if (!enabled) {
      this.clearDiagnostics();
    }
    console.log(`CombinedExtractor: Diagnostics ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Configura los umbrales de priorización
   */
  public setPrioritizationThresholds(highThreshold: number, mediumThreshold: number): void {
    this.highPriorityConfidence = highThreshold;
    this.mediumPriorityConfidence = mediumThreshold;
    console.log(`CombinedExtractor: Prioritization thresholds updated - High: ${highThreshold}, Medium: ${mediumThreshold}`);
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
    
    // Limpiar diagnósticos al reiniciar
    this.clearDiagnostics();
    
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

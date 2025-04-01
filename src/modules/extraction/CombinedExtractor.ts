
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Extractor combinado que integra la extracción de latidos y señal PPG
 * Proporciona una salida unificada con todos los datos extraídos
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
 * Clase para extracción combinada de datos PPG y latidos
 */
export class CombinedExtractor {
  private ppgExtractor: PPGSignalExtractor;
  private heartbeatExtractor: HeartbeatExtractor;
  
  constructor() {
    this.ppgExtractor = createPPGSignalExtractor();
    this.heartbeatExtractor = createHeartbeatExtractor();
  }
  
  /**
   * Procesa un valor PPG y extrae toda la información disponible
   * @param value Valor PPG sin procesar
   * @returns Resultado combinado con todos los datos extraídos
   */
  public processValue(value: number): CombinedExtractionResult {
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
   * Reinicia ambos extractores
   */
  public reset(): void {
    this.ppgExtractor.reset();
    this.heartbeatExtractor.reset();
  }
}

/**
 * Crea una instancia de extractor combinado
 */
export const createCombinedExtractor = (): CombinedExtractor => {
  return new CombinedExtractor();
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

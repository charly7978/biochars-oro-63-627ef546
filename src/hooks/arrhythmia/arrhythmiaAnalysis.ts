
import { 
  analyzeRRIntervals, 
  logRRAnalysis, 
  logPossibleArrhythmia, 
  logConfirmedArrhythmia, 
  logIgnoredArrhythmia 
} from '../../utils/rrAnalysisUtils';
import { VitalSignsResult } from '../../modules/vital-signs/VitalSignsProcessor';

/**
 * Configuración para detección de arritmias
 */
export interface ArrhythmiaConfig {
  MIN_TIME_BETWEEN_ARRHYTHMIAS: number;
  MAX_ARRHYTHMIAS_PER_SESSION: number;
  SIGNAL_QUALITY_THRESHOLD: number;
}

/**
 * Procesador especializado para análisis de arritmias
 * Algoritmo ultra conservador para minimizar falsos positivos
 */
export class ArrhythmiaAnalyzer {
  private lastArrhythmiaTime: number = 0;
  private hasDetectedArrhythmia: boolean = false;
  private arrhythmiaCounter: number = 0;
  private config: ArrhythmiaConfig;
  // Algoritmo ultra exigente que requiere muchas anomalías consecutivas
  private consecutiveAbnormalIntervals: number = 0;
  private readonly CONSECUTIVE_THRESHOLD = 15; // Extremadamente alto para minimizar falsos positivos

  constructor(config: ArrhythmiaConfig) {
    this.config = config;
  }

  /**
   * Procesa datos de arritmia basado en intervalos RR
   * Con algoritmo ultra conservador
   */
  public processArrhythmiaData(
    rrData: { intervals: number[], lastPeakTime: number | null } | undefined,
    result: VitalSignsResult
  ): VitalSignsResult {
    const currentTime = Date.now();
    
    // Si no hay datos RR válidos, retornar el resultado sin cambios
    if (!rrData?.intervals || rrData.intervals.length < 15) { // Aumentado a 15 para mayor estabilidad
      // Si previamente detectamos una arritmia, mantener ese estado
      if (this.hasDetectedArrhythmia) {
        return {
          ...result,
          arrhythmiaStatus: `ARRITMIA DETECTADA|${this.arrhythmiaCounter}`,
          lastArrhythmiaData: null
        };
      }
      
      return {
        ...result,
        arrhythmiaStatus: `SIN ARRITMIAS|${this.arrhythmiaCounter}`
      };
    }
    
    const lastIntervals = rrData.intervals.slice(-15); // Aumentado a 15
    
    // Analizar intervalos RR para detectar posibles arritmias con algoritmo ultra conservador
    const { hasArrhythmia, shouldIncrementCounter, analysisData } = 
      analyzeRRIntervals(
        rrData, 
        currentTime, 
        this.lastArrhythmiaTime, 
        this.arrhythmiaCounter,
        this.config.MIN_TIME_BETWEEN_ARRHYTHMIAS,
        this.config.MAX_ARRHYTHMIAS_PER_SESSION
      );
    
    if (analysisData) {
      // Registrar análisis RR para depuración
      logRRAnalysis(analysisData, lastIntervals);
      
      // Si se detecta una posible arritmia, registrar detalles
      if (hasArrhythmia) {
        logPossibleArrhythmia(analysisData);
        
        // Análisis de continuidad de anomalías - ultra estricto
        // Solo incrementamos contador si la variación es extrema (>70%)
        if (hasArrhythmia && analysisData.rrVariation > 0.7) {
          this.consecutiveAbnormalIntervals++;
        } else {
          // Si no cumple con el criterio extremo, resetear contador
          this.consecutiveAbnormalIntervals = 0;
        }
        
        // Verificar si debemos incrementar contador (con umbral extraordinariamente alto)
        // Requerimos muchísimas anomalías consecutivas para confirmar arritmia
        if (shouldIncrementCounter && 
            (this.consecutiveAbnormalIntervals >= this.CONSECUTIVE_THRESHOLD)) {
          // Confirmamos la arritmia e incrementamos el contador
          this.hasDetectedArrhythmia = true;
          this.arrhythmiaCounter += 1;
          this.lastArrhythmiaTime = currentTime;
          this.consecutiveAbnormalIntervals = 0; // Reiniciar contador de anomalías
          
          // Registrar la arritmia confirmada
          logConfirmedArrhythmia(analysisData, lastIntervals, this.arrhythmiaCounter);

          return {
            ...result,
            arrhythmiaStatus: `ARRITMIA DETECTADA|${this.arrhythmiaCounter}`,
            lastArrhythmiaData: {
              timestamp: currentTime,
              rmssd: analysisData.rmssd,
              rrVariation: analysisData.rrVariation
            }
          };
        } else {
          // Arritmia detectada pero ignorada (demasiado reciente o máximo alcanzado)
          logIgnoredArrhythmia(
            currentTime - this.lastArrhythmiaTime,
            this.config.MAX_ARRHYTHMIAS_PER_SESSION,
            this.arrhythmiaCounter
          );
        }
      } else {
        // Si no hay arritmia, resetear contador de anomalías
        this.consecutiveAbnormalIntervals = 0;
      }
    }
    
    // Si previamente detectamos una arritmia, mantener ese estado
    if (this.hasDetectedArrhythmia) {
      return {
        ...result,
        arrhythmiaStatus: `ARRITMIA DETECTADA|${this.arrhythmiaCounter}`,
        lastArrhythmiaData: null
      };
    }
    
    // No se detectaron arritmias
    return {
      ...result,
      arrhythmiaStatus: `SIN ARRITMIAS|${this.arrhythmiaCounter}`
    };
  }

  /**
   * Obtiene el contador actual de arritmias
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaCounter;
  }

  /**
   * Establece un nuevo contador de arritmias
   */
  public setArrhythmiaCounter(count: number): void {
    this.arrhythmiaCounter = count;
  }

  /**
   * Reinicia el analizador de arritmias
   */
  public reset(): void {
    this.lastArrhythmiaTime = 0;
    this.hasDetectedArrhythmia = false;
    this.arrhythmiaCounter = 0;
    this.consecutiveAbnormalIntervals = 0;
  }
}
